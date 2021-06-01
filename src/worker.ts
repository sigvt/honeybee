import BeeQueue from "bee-queue";
import BanAction from "./models/BanAction";
import Chat from "./models/Chat";
import DeleteAction from "./models/DeleteAction";
import { initMongo } from "./modules/db";
import { getQueueInstance, Job } from "./modules/queue";
import {
  Action,
  FetchChatErrorStatus,
  iterateChat,
  ReloadContinuationType,
} from "masterchat/lib/chat";
import { fetchContext } from "masterchat/lib/context";
import { groupBy, timeoutThen } from "./util";
import SuperChat from "./models/SuperChat";

export interface Stats {
  handled: number;
  errors: number;
  isWarmingUp: boolean;
}

export enum ErrorCode {
  MembershipOnly,
  UnknownError,
}

export interface Result {
  error: ErrorCode | null;
  result?: Stats;
}

const JOB_CONCURRENCY = Number(process.env.JOB_CONCURRENCY || 1);

function msecToMin(msec: number) {
  return Math.floor(msec / 1000 / 60);
}
function minToMsec(min: number) {
  return Math.ceil(min * 60 * 1000);
}

function workerLog(...obj: any) {
  console.log(`worker:`, ...obj);
}

async function handleJob(job: BeeQueue.Job<Job>): Promise<Result> {
  const { videoId } = job.data;

  let stats: Stats = { handled: 0, errors: 0, isWarmingUp: true };

  job.reportProgress(stats); // initialize

  function refreshStats(actions: Action[]) {
    stats.handled += actions.length;
    job.reportProgress(stats);
  }

  // warming up (0 to 30 sec)
  const warmUpDuration = Math.floor(Math.random() * 1000 * 30);
  workerLog(
    `WarmUp: waiting for ${Math.ceil(
      warmUpDuration / 1000
    )} seconds for ${videoId}`
  );
  const interval = setInterval(() => {
    job.reportProgress(stats);
  }, 1000);
  await timeoutThen(warmUpDuration);
  clearInterval(interval);

  stats.isWarmingUp = false;
  job.reportProgress(stats);

  const context = await fetchContext(videoId);
  if (!context) {
    throw new Error("possibly YT ban");
  }

  const { metadata, continuations, auth } = context;

  // check if the video is valid
  if (!metadata) {
    workerLog(`${videoId} is membership only stream`);
    return { error: ErrorCode.MembershipOnly };
  }

  const { isLive } = metadata;

  if (!isLive) {
    workerLog(`${videoId} is not live`);
    return { error: ErrorCode.UnknownError };
  }

  if (!continuations) {
    // immediately fail so it can be queued as a delayed task
    throw new Error("chat is disabled");
  }

  workerLog(`start collecting ${videoId}`);

  const liveChatIteratorOptions = {
    token: continuations[ReloadContinuationType.All].token,
    ...auth,
  };

  // iterate over live chat
  chatIteration: for await (const response of iterateChat(
    liveChatIteratorOptions
  )) {
    if (response.error) {
      // TODO: properly handle various type of errors
      // if reject  -> will retry
      // if resolve -> throw back at scheduler
      switch (response.error.status) {
        case FetchChatErrorStatus.ContinuationNotFound: {
          // live stream is over
          break chatIteration;
        }
        default: {
          workerLog(`Error while handling ${videoId}: `, response.error);
          throw new Error(
            `${response.error.status}: ${response.error.message}`
          );
        }
      }
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

      for (const type of actionTypes) {
        try {
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
              await Chat.insertMany(payload, insertOptions);
              break;
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
              await SuperChat.insertMany(payload, insertOptions);
              break;
            }
            case "markChatItemAsDeletedAction": {
              const payload = groupedActions[type].map((action) => ({
                timestamp: action.timestamp,
                targetId: action.targetId,
                retracted: action.retracted,
                originVideoId: action.originVideoId,
                originChannelId: action.originChannelId,
              }));
              await DeleteAction.insertMany(payload, insertOptions);
              break;
            }
            case "markChatItemsByAuthorAsDeletedAction": {
              const payload = groupedActions[type].map((action) => ({
                timestamp: action.timestamp,
                channelId: action.channelId,
                originVideoId: action.originVideoId,
                originChannelId: action.originChannelId,
              }));
              await BanAction.insertMany(payload, insertOptions);
              break;
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
              break;
            }
          }
        } catch (err) {
          // insertedDocs: []
          // result: BulkWriteResult,
          // writeErrors: WriteError
          // code: number
          stats.errors += 1;
          if (err.code === 11000) {
            workerLog(
              `some chats were dupes, inserted=${err.insertedDocs.length} code=${err.code}`
            );
          } else {
            // getaddrinfo ENOTFOUND mongo
            workerLog(
              "unrecognized error",
              err.type,
              err.code,
              err.errno,
              err.message
            );
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
    await timeoutThen(delay);
  }

  workerLog(`Live stream is over: https://www.youtube.com/watch?v=${videoId}`);

  return { error: null, result: stats };
}

// collect live chat and save to mongodb
export async function runWorker() {
  const disconnectFromMongo = await initMongo();
  const queue = getQueueInstance({ activateDelayedJobs: true });

  queue.on("ready", () => {
    workerLog(
      `#################### queue ready (concurrency: ${JOB_CONCURRENCY})`
    );
  });

  // it's the queue instance that happened to detect the stalled job.
  // queue.on("stalled", (jobId) => {
  //   workerLog(`detected stalled job ${jobId} `);
  // });

  // Redis related error
  queue.on("error", (err) => {
    // code: 'EHOSTUNREACH'
    workerLog("redis related error:", err);
    process.exit(1);
  });

  // Job related error
  // queue.on("failed", (job, err) => {
  //   workerLog(`while handling ${job.id} got ${err.message}`);
  // });

  queue.process<Result>(JOB_CONCURRENCY, handleJob);

  // Some reasonable period of time for all your concurrent jobs to finish
  // processing. If a job does not finish processing in this time, it will stall
  // and be retried. As such, do attempt to make your jobs idempotent, as you
  // generally should with any queue that provides at-least-once delivery.
  const TIMEOUT = 30 * 1000;

  process.on("uncaughtException", async (err) => {
    workerLog("!!!!!!!!!!!!!!uncaughtException", err);

    // Queue#close is idempotent - no need to guard against duplicate calls.
    try {
      await queue.close(TIMEOUT);
      await disconnectFromMongo();
    } catch (err) {
      workerLog("!!!!!!!!!!!!!!bee-queue failed to shut down gracefully", err);
    }
    process.exit(1);
  });
}
