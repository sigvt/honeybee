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
import {
  Action,
  iterateChat,
  ReloadContinuationType,
} from "masterchat/lib/chat";
import { fetchContext } from "masterchat/lib/context";
import { groupBy } from "./util";
import SuperChat from "./models/SuperChat";

const JOB_CONCURRENCY = Number(process.env.JOB_CONCURRENCY || 1);

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

  const { auth, metadata, continuations } = await fetchContext(videoId);

  // check if the video is valid
  if (!metadata) {
    workerLog("Membership only stream");
    return { error: ErrorCode.MembershipOnly };
  }

  const { title, channelName, isLive } = metadata;

  workerLog(`${title} (${channelName}) isLive=${isLive}`);

  if (!isLive) {
    console.log("only live stream is supported");
    return { error: ErrorCode.UnknownError };
  }

  if (!continuations) {
    // immediately fail so it can be queued as a delayed task
    throw new Error("reload continuation not found, meaning chat is disabled.");
  }

  const liveChatIteratorOptions = {
    token: continuations[ReloadContinuationType.All].token,
    ...auth,
  };

  // iterate over live chat
  for await (const response of iterateChat(liveChatIteratorOptions)) {
    if (response.error) {
      // TODO: properly handle various type of errors
      continue;
    }

    const { actions, continuation } = response;

    if (actions.length > 0) {
      const actionsWithOrigin = actions.map((action) => ({
        ...action,
        originVideoId: metadata.id,
        originChannelId: metadata.channelId,
      }));

      const groupedActions = groupBy(actionsWithOrigin, "type");
      const insertOptions = { ordered: false };
      const actionTypes = Object.keys(groupedActions) as Action["type"][];

      const bulkWrite = actionTypes.map((type) => {
        switch (type) {
          case "addChatItemAction": {
            const payload = groupedActions[type].map((action) => ({
              timestamp: action.timestamp,
              id: action.id,
              message: action.rawMessage,
              membership: action.membership,
              authorName: action.authorName,
              authorChannelId: action.authorChannelId,
              authorPhoto: action.authorPhoto,
              isVerified: action.isVerified,
              isOwner: action.isOwner,
              isModerator: action.isModerator,
              originVideoId: action.originVideoId,
              originChannelId: action.originChannelId,
            }));
            return Chat.insertMany(payload, insertOptions);
          }
          case "addSuperChatItemAction": {
            const payload = groupedActions[type].map((action) => ({
              timestamp: action.timestamp,
              id: action.id,
              message: action.rawMessage,
              purchaseAmount: action.superchat.amount,
              currency: action.superchat.currency,
              significance: action.superchat.significance,
              color: action.superchat.color,
              authorName: action.authorName,
              authorChannelId: action.authorChannelId,
              authorPhoto: action.authorPhoto,
              originVideoId: action.originVideoId,
              originChannelId: action.originChannelId,
            }));
            return SuperChat.insertMany(payload, insertOptions);
          }
          case "markChatItemAsDeletedAction": {
            const payload = groupedActions[type].map((action) => ({
              timestamp: action.timestamp,
              targetId: action.targetId,
              retracted: action.retracted,
              originVideoId: action.originVideoId,
              originChannelId: action.originChannelId,
            }));
            return DeleteAction.insertMany(payload, insertOptions);
          }
          case "markChatItemsByAuthorAsDeletedAction": {
            const payload = groupedActions[type].map((action) => ({
              timestamp: action.timestamp,
              channelId: action.channelId,
              originVideoId: action.originVideoId,
              originChannelId: action.originChannelId,
            }));
            return BanAction.insertMany(payload, insertOptions);
          }
          case "addSuperChatTickerAction":
          case "addMembershipItemAction":
          case "addMembershipTickerAction":
          case "addPlaceholderItemAction":
          case "replaceChatItemAction":
          case "addSuperStickerItemAction":
          case "addSuperStickerTickerAction":
          case "addBannerAction":
          case "removeBannerAction":
          case "showTooltipAction":
          case "addViewerEngagementMessageAction":
            break;
          default: {
            const _exhaust: never = type;
            return _exhaust;
          }
        }
      });

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

    // live chat is over so skip waiting for next tick
    if (!continuation) break;

    const delay = continuation.timeoutMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
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
