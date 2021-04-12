import BeeQueue from "bee-queue";
import BanAction from "./models/BanAction";
import Chat from "./models/Chat";
import DeleteAction from "./models/DeleteAction";
import { initMongo } from "./modules/db";
import {
  ErrorCode,
  getQueueInstance,
  Job,
  Result,
  Stats,
} from "./modules/queue";
import { iterateChat } from "./modules/youtube/chat";
import { fetchContext } from "./modules/youtube/context";
import { Action, ReloadContinuationType } from "./modules/youtube/types/chat";
import { groupBy } from "./util";

const JOB_CONCURRENCY = Number(process.env.JOB_CONCURRENCY || 50);

async function handleJob(job: BeeQueue.Job<Job>): Promise<Result> {
  const { videoId } = job.data;

  let stats: Stats = { chat: 0, retracted: 0, deleted: 0, banned: 0 };

  job.reportProgress(stats); // initialize

  function workerLog(...obj: any) {
    console.log(`WORKER [${videoId}]:`, ...obj);
  }

  function refreshStats(actions: Action[]) {
    for (const action of actions) {
      switch (action.type) {
        case "addChatItemAction":
          stats.chat += 1;
          break;
        case "markChatItemAsDeletedAction":
          if (action.retracted) {
            stats.retracted += 1;
          } else {
            stats.deleted += 1;
            workerLog("DELETED", action.targetId);
          }
          break;
        case "markChatItemsByAuthorAsDeletedAction":
          stats.banned += 1;
          workerLog("BANNED", action.channelId);
          break;
      }
    }
    job.reportProgress(stats);
  }

  workerLog(`Starting worker process for`, videoId);

  const { apiKey, client, metadata } = await fetchContext(videoId);

  // check if the video is valid
  if (!metadata) {
    workerLog("Membership only stream");
    return { error: ErrorCode.MembershipOnly };
  }

  const { continuations, title, channelName, isLive } = metadata;

  workerLog(`${title} (${channelName}) isLive=${isLive}`);

  if (!isLive) {
    console.log("!isLive");
    return { error: ErrorCode.UnknownError };
  }

  if (!continuations) {
    throw new Error("reload continuation not found, meaning chat is disabled.");
  }

  const liveChatIteratorOptions = {
    token: continuations[ReloadContinuationType.All].token,
    apiKey,
    client,
    isLiveChat: true,
  };

  // iterate over live chat
  for await (const { actions, delay } of iterateChat(liveChatIteratorOptions)) {
    if (actions.length > 0) {
      const actionsWithOrigin = actions.map((action) => ({
        ...action,
        originVideoId: metadata.id,
        originChannelId: metadata.channelId,
      }));

      const grouped = groupBy(actionsWithOrigin, "type");
      const insertOptions = { ordered: false };

      const bulkWrite = (Object.keys(grouped) as Action["type"][]).map(
        (key) => {
          const payload = grouped[key];
          switch (key) {
            case "addChatItemAction":
              return Chat.insertMany(payload, insertOptions);
            case "markChatItemAsDeletedAction":
              return DeleteAction.insertMany(payload, insertOptions);
            case "markChatItemsByAuthorAsDeletedAction":
              return BanAction.insertMany(payload, insertOptions);
            default:
              const _exhaust: never = key;
              return _exhaust;
          }
        }
      );

      for (const write of bulkWrite) {
        try {
          await write;
        } catch (err) {
          // insertedDocs: []
          // result: BulkWriteResult,
          // writeErrors: WriteError
          // code: number
          console.log("ERROR", err.insertedDocs.length, err.code, err.message);
          if (err.code !== 11000) {
            throw err;
          }
        }
      }

      // fancy logging
      refreshStats(actions);
    }

    if (isLive) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  workerLog(`Live stream is over: https://www.youtube.com/watch?v=${videoId}`);

  return { error: null, result: stats };
}

// collect live chat and save to mongodb
export async function runWorker() {
  const disconnectFromMongo = await initMongo();
  const queue = getQueueInstance({ activateDelayedJobs: true });

  queue.on("ready", () => {
    console.log(`WORKER READY (concurrency: ${JOB_CONCURRENCY})`);
  });

  queue.on("stalled", (jobId) => {
    console.log(`Job ${jobId} stalled and will be reprocessed`);
  });

  queue.process<Result>(JOB_CONCURRENCY, handleJob);

  // Some reasonable period of time for all your concurrent jobs to finish
  // processing. If a job does not finish processing in this time, it will stall
  // and be retried. As such, do attempt to make your jobs idempotent, as you
  // generally should with any queue that provides at-least-once delivery.
  const TIMEOUT = 30 * 1000;

  process.on("uncaughtException", async () => {
    // Queue#close is idempotent - no need to guard against duplicate calls.
    try {
      await queue.close(TIMEOUT);
      await disconnectFromMongo();
    } catch (err) {
      console.error("bee-queue failed to shut down gracefully", err);
    }
    process.exit(1);
  });
}
