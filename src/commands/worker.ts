import BeeQueue from "bee-queue";
import { Action, delay, Masterchat, MasterchatError } from "masterchat";
import { MongoError } from "mongodb";
import { FetchError } from "node-fetch";
import { JOB_CONCURRENCY, SHUTDOWN_TIMEOUT } from "../constants";
import { ErrorCode, Result, Stats } from "../interfaces";
import BanAction from "../models/BanAction";
import Chat from "../models/Chat";
import DeleteAction from "../models/DeleteAction";
import SuperChat from "../models/SuperChat";
import { initMongo } from "../modules/db";
import { getQueueInstance, Job } from "../modules/queue";
import { groupBy } from "../util";

async function handleJob(job: BeeQueue.Job<Job>): Promise<Result> {
  const {
    videoId,
    stream: {
      channel: { id: channelId },
    },
  } = job.data;

  const mc = new Masterchat(videoId, channelId, { mode: "live" });
  let stats: Stats = { handled: 0, errors: 0, isWarmingUp: true };

  function videoLog(...obj: any) {
    console.log(`${videoId} ${channelId} -`, ...obj);
  }

  function refreshStats(actions: Action[]) {
    stats.handled += actions.length;
    job.reportProgress(stats);
  }

  async function handleActions(actions: Action[]) {
    const actionsWithOrigin = actions.map((action) => ({
      ...action,
      originVideoId: mc.videoId,
      originChannelId: mc.channelId,
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
              message: action.message,
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
              message:
                action.message && action.message.length > 0
                  ? action.message
                  : null,
              purchaseAmount: action.amount,
              currency: action.currency,
              significance: action.significance,
              color: action.color,
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
          case "addBannerAction":
          case "addMembershipItemAction":
          case "addMembershipTickerAction":
          case "addPlaceholderItemAction":
          case "addSuperChatTickerAction":
          case "addSuperStickerItemAction":
          case "addSuperStickerTickerAction":
          case "addViewerEngagementMessageAction":
          case "closePanelAction":
          case "modeChangeAction":
          case "removeBannerAction":
          case "replaceChatItemAction":
          case "showPanelAction":
          case "showPollPanelAction":
          case "showTooltipAction":
          case "updatePollAction":
          case "addMembershipMilestoneItemAction":
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

        if (err instanceof MongoError) {
          if (err.code === 11000) {
            videoLog(`rescued ${(err as any).insertedDocs.length} chat(s)`);
            continue;
          } else {
            videoLog(
              `unrecognized mongo error: code=${err.code} msg=${err.errmsg} labels=${err.errorLabels}`
            );
          }
        } else if (err instanceof FetchError) {
          // getaddrinfo ENOTFOUND mongo
          videoLog("fetch error", err.type, err.code, err.errno, err.message);
        } else if (err instanceof Error) {
          videoLog("unrecognized error", err.name, err.message);
          process.exit(1);
        }

        throw err;
      }
    }

    // fancy logging
    refreshStats(actions);
  }

  // wait up to 10 sec (max invalidation timeout) to scatter request timings
  job.reportProgress(stats);
  const randomTimeoutMs = Math.floor(Math.random() * 1000 * 10);
  const interval = setInterval(() => {
    job.reportProgress(stats);
  }, 5000);
  await delay(randomTimeoutMs);
  clearInterval(interval);

  stats.isWarmingUp = false;
  job.reportProgress(stats);

  videoLog(`start processing live chats (buffer: ${randomTimeoutMs}ms)`);

  // iterate over live chat
  try {
    for await (const { actions } of mc.iterate()) {
      if (actions.length > 0) {
        await handleActions(actions);
      }
    }
  } catch (err) {
    if (err instanceof MasterchatError) {
      switch (err.code) {
        case "membersOnly": {
          // let the scheduler ignore this stream from index
          videoLog(`members-only stream`);
          return { error: ErrorCode.MembersOnly };
        }
        case "denied": {
          return { error: ErrorCode.Ban };
        }
        case "disabled": {
          // immediately fail so that the scheduler can push the job to delayed queue
          // TODO: handle when querying archived stream
          throw new Error(
            `chat is disabled OR archived stream (start_scheduled: ${job.data.stream.start_scheduled})`
          );
        }
        case "unavailable": {
          videoLog("unavailable");
          return { error: ErrorCode.Unavailable, result: stats };
        }
        case "private": {
          videoLog("private");
          return { error: ErrorCode.Private, result: stats };
        }
      }
    }

    // change delay backoff time to 30 sec
    job.backoff("fixed", 30 * 1000);

    // unrecognized errors
    throw err;
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
      await queue.close(SHUTDOWN_TIMEOUT);
      await disconnectFromMongo();
    } catch (err) {
      console.log("bee-queue failed to shut down gracefully", err);
    }

    process.exit(0);
  });

  queue.on("ready", () => {
    console.log(`worker is ready (concurrency: ${JOB_CONCURRENCY})`);
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
