import BeeQueue from "bee-queue";
import { fetchContext, iterateChat } from "masterchat";
import { Action, FetchChatErrorStatus } from "masterchat/lib/chat";
import { YTChatErrorStatus } from "masterchat/lib/types/chat";
import { JOB_CONCURRENCY, SHUTDOWN_TIMEOUT } from "../constants";
import { ErrorCode, Result, Stats } from "../interfaces";
import BanAction from "../models/BanAction";
import Chat from "../models/Chat";
import DeleteAction from "../models/DeleteAction";
import SuperChat from "../models/SuperChat";
import { initMongo } from "../modules/db";
import { getQueueInstance, Job } from "../modules/queue";
import { groupBy, timeoutThen } from "../util";

async function handleJob(job: BeeQueue.Job<Job>): Promise<Result> {
  const { videoId } = job.data;

  function videoLog(...obj: any) {
    console.log(`${videoId} -`, ...obj);
  }

  let stats: Stats = { handled: 0, errors: 0, isWarmingUp: true };

  job.reportProgress(stats); // initialize

  function refreshStats(actions: Action[]) {
    stats.handled += actions.length;
    job.reportProgress(stats);
  }

  // warming up (0 to 60 sec)
  const warmUpDuration = Math.floor(Math.random() * 1000 * 60);
  videoLog(
    `waiting for ${Math.ceil(warmUpDuration / 1000)} seconds before proceeding`
  );
  const interval = setInterval(() => {
    job.reportProgress(stats);
  }, 5000);
  await timeoutThen(warmUpDuration);
  clearInterval(interval);

  stats.isWarmingUp = false;
  job.reportProgress(stats);

  let context;
  try {
    context = await fetchContext(videoId);
  } catch (err) {
    if (err.name === "EYTBAN") {
      videoLog("429 detected");
      return { error: ErrorCode.Ban };
    }
    throw err;
  }

  if (!context) {
    videoLog(
      "no context",
      new Date(),
      "https://www.youtube.com/watch?v=" + videoId
    );
    // already turned into membership-only stream
    return { error: ErrorCode.MembersOnly };
  }

  const { metadata, chat, apiKey } = context;

  // check if the video is valid
  if (!metadata) {
    videoLog(`membership only stream`);
    return { error: ErrorCode.MembersOnly };
  }

  const { isLive } = metadata;

  if (!isLive) {
    videoLog(`offline`);
    return { error: ErrorCode.UnknownError };
  }

  if (!chat) {
    // immediately fail so it can be queued as a delayed task
    throw new Error("chat is disabled");
  }

  videoLog(`start processing live chats`);

  // change delay backoff time to 1 min
  job.backoff("fixed", 1 * 60 * 1000);

  const liveChatIteratorOptions = {
    token: chat.continuations.all.token,
    apiKey,
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
        case FetchChatErrorStatus.LiveChatDisabled: {
          videoLog("IterError: ContinuationNotFound");
          // live stream is over
          break chatIteration;
        }
        case YTChatErrorStatus.Unavailable:
        case YTChatErrorStatus.NotFound:
        case YTChatErrorStatus.PermissionDenied:
        default: {
          videoLog(`IterError:`, response.error.status, response.error.message);
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
            case "updateLiveChatPollAction":
            case "modeChangeAction":
            case "showLiveChatActionPanelAction":
            case "closeLiveChatActionPanelAction":
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
            videoLog(
              `some chats were dupes and ignored while ${err.insertedDocs.length} chat(s) inserted (${err.code})`
            );
          } else {
            // getaddrinfo ENOTFOUND mongo
            videoLog(
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
    if (!continuation) {
      videoLog("live chat is over so skip waiting for next tick");
      break;
    }

    const delay = continuation.timeoutMs;
    await timeoutThen(delay);
  }

  videoLog(`live stream ended`);

  return { error: null, result: stats };
}

// collect live chat and save to mongodb
export async function runWorker() {
  const disconnectFromMongo = await initMongo();
  const queue = getQueueInstance({ activateDelayedJobs: true });

  process.on("SIGTERM", async () => {
    console.log("quitting worker (SIGTERM) ...");

    try {
      await disconnectFromMongo();
      await queue.close(SHUTDOWN_TIMEOUT);
    } catch (err) {
      console.log("bee-queue failed to shut down gracefully", err);
    }
    process.exit(0);
  });

  queue.on("ready", () => {
    console.log(`starting worker (concurrency: ${JOB_CONCURRENCY})`);
  });

  // Redis related error
  queue.on("error", (err) => {
    // code: 'EHOSTUNREACH'
    // code: 'UNCERTAIN_STATE'
    console.log("queue got error:", (err as any)?.code, err.message);
    process.exit(1);
  });

  queue.process<Result>(JOB_CONCURRENCY, handleJob);
}
