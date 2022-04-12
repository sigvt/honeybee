import https from "https";
import axios from "axios";
import BeeQueue from "bee-queue";
import {
  Action,
  delay,
  Masterchat,
  MasterchatError,
  Membership as MCMembership,
  stringify,
  YTEmojiRun,
} from "masterchat";
import { MongoError } from "mongodb";
import { FetchError } from "node-fetch";
import { JOB_CONCURRENCY, SHUTDOWN_TIMEOUT } from "../constants";
import { ErrorCode, Result, Stats } from "../interfaces";
import BanActionModel, { BanAction } from "../models/BanAction";
import BannerActionModel, { BannerAction } from "../models/BannerAction";
import ChatModel, { Chat } from "../models/Chat";
import DeletionModel, { Deletion } from "../models/Deletion";
import MembershipModel, { Membership } from "../models/Membership";
import MilestoneModel, { Milestone } from "../models/Milestone";
import ModeChangeModel, { ModeChange } from "../models/ModeChange";
import PlaceholderModel, { Placeholder } from "../models/Placeholder";
import SuperChatModel, { SuperChat } from "../models/SuperChat";
import SuperStickerModel, { SuperSticker } from "../models/SuperSticker";
import { initMongo } from "../modules/db";
import { getQueueInstance, Job } from "../modules/queue";
import { groupBy } from "../util";

function emojiHandler(run: YTEmojiRun) {
  const { emoji } = run;

  // https://codepoints.net/specials
  // const term =
  //   emoji.isCustomEmoji || emoji.emojiId === ""
  //     ? `\uFFF9${emoji.shortcuts[emoji.shortcuts.length - 1]}\uFFFA${
  //         emoji.image.thumbnails[0].url
  //       }\uFFFB`
  //     : emoji.emojiId;
  const term =
    emoji.isCustomEmoji || emoji.emojiId === ""
      ? `\uFFF9${emoji.shortcuts[emoji.shortcuts.length - 1]}\uFFFB`
      : emoji.emojiId;

  return term;
}

function normalizeMembership(membership?: MCMembership) {
  return membership ? membership.since ?? "new" : undefined;
}

const stringifyOptions = {
  spaces: false,
  emojiHandler,
};
const insertOptions = { ordered: false };

async function handleJob(job: BeeQueue.Job<Job>): Promise<Result> {
  const {
    videoId,
    stream: {
      channel: { id: channelId },
    },
  } = job.data;

  const mc = new Masterchat(videoId, channelId, {
    mode: "live",
    axiosInstance: axios.create({
      timeout: 4000,
      httpsAgent: new https.Agent({
        keepAlive: true,
      }),
    }),
  });
  let stats: Stats = { handled: 0, errors: 0, isWarmingUp: true };

  function videoLog(...obj: any) {
    console.log(`${videoId} ${channelId} -`, ...obj);
  }

  function refreshStats(actions: Action[]) {
    stats.handled += actions.length;
    job.reportProgress(stats);
  }

  async function handleActions(actions: Action[]) {
    const groupedActions = groupBy(actions, "type");
    const actionTypes = Object.keys(groupedActions) as Action["type"][];

    for (const type of actionTypes) {
      try {
        switch (type) {
          case "addChatItemAction": {
            const payload: Chat[] = groupedActions[type].map((action) => {
              const normMessage = stringify(action.message!, stringifyOptions);
              const normMembership = normalizeMembership(action.membership);
              return {
                timestamp: action.timestamp,
                id: action.id,
                message: normMessage,
                authorName: action.authorName,
                authorChannelId: action.authorChannelId,
                membership: normMembership,
                isVerified: action.isVerified,
                isOwner: action.isOwner,
                isModerator: action.isModerator,
                originVideoId: mc.videoId,
                originChannelId: mc.channelId,
              };
            });
            await ChatModel.insertMany(payload, insertOptions);
            break;
          }
          case "addSuperChatItemAction": {
            const payload: SuperChat[] = groupedActions[type].map((action) => {
              const normMessage =
                action.message && action.message.length > 0
                  ? stringify(action.message, stringifyOptions)
                  : null;

              return {
                timestamp: action.timestamp,
                id: action.id,
                message: normMessage,
                purchaseAmount: action.amount,
                currency: action.currency,
                significance: action.significance,
                color: action.color,
                authorName: action.authorName,
                authorChannelId: action.authorChannelId,
                originVideoId: mc.videoId,
                originChannelId: mc.channelId,
              };
            });
            await SuperChatModel.insertMany(payload, insertOptions);
            break;
          }
          case "addSuperStickerItemAction": {
            const payload: SuperSticker[] = groupedActions[type].map(
              (action) => {
                return {
                  timestamp: action.timestamp,
                  id: action.id,
                  authorName: action.authorName,
                  authorChannelId: action.authorChannelId,
                  amount: action.amount,
                  currency: action.currency,
                  text: action.stickerText,
                  // significance: action.significance,
                  // color: action.color,
                  originVideoId: mc.videoId,
                  originChannelId: mc.channelId,
                };
              }
            );

            await SuperStickerModel.insertMany(payload, insertOptions);
            break;
          }
          case "markChatItemAsDeletedAction": {
            const payload: Deletion[] = groupedActions[type].map((action) => ({
              targetId: action.targetId,
              retracted: action.retracted,
              originVideoId: mc.videoId,
              originChannelId: mc.channelId,
              timestamp: action.timestamp,
            }));
            await DeletionModel.insertMany(payload, insertOptions);
            break;
          }
          case "markChatItemsByAuthorAsDeletedAction": {
            const payload: BanAction[] = groupedActions[type].map((action) => ({
              channelId: action.channelId,
              originVideoId: mc.videoId,
              originChannelId: mc.channelId,
              timestamp: action.timestamp,
            }));
            await BanActionModel.insertMany(payload, insertOptions);
            break;
          }
          case "addMembershipItemAction": {
            const payload: Membership[] = groupedActions[type].map(
              (action) => ({
                id: action.id,
                level: action.level,
                since: action.membership.since,
                authorName: action.authorName!,
                authorChannelId: action.authorChannelId,
                originVideoId: mc.videoId,
                originChannelId: mc.channelId,
                timestamp: action.timestamp,
              })
            );
            await MembershipModel.insertMany(payload, insertOptions);
            break;
          }
          case "addMembershipMilestoneItemAction": {
            const payload: Milestone[] = groupedActions[type].map((action) => {
              const normMessage =
                action.message && action.message.length > 0
                  ? stringify(action.message, stringifyOptions)
                  : null;

              return {
                id: action.id,
                level: action.level,
                duration: action.duration,
                since: action.membership.since,
                message: normMessage,
                authorName: action.authorName,
                authorChannelId: action.authorChannelId,
                originVideoId: mc.videoId,
                originChannelId: mc.channelId,
                timestamp: action.timestamp,
              };
            });
            await MilestoneModel.insertMany(payload, insertOptions);
            break;
          }
          case "addBannerAction": {
            const payload: BannerAction[] = groupedActions[type].map(
              (action) => {
                const normTitle = stringify(action.title, stringifyOptions);
                const normMessage = stringify(action.message, stringifyOptions);
                const normMembership = normalizeMembership(action.membership);
                return {
                  timestamp: action.timestamp,
                  actionId: action.id,
                  title: normTitle,
                  rawTitle: action.title,
                  message: normMessage,
                  authorName: action.authorName,
                  authorChannelId: action.authorChannelId,
                  membership: normMembership,
                  isVerified: action.isVerified,
                  isOwner: action.isOwner,
                  isModerator: action.isModerator,
                  originVideoId: mc.videoId,
                  originChannelId: mc.channelId,
                };
              }
            );

            await BannerActionModel.insertMany(payload, insertOptions);
            break;
          }
          case "modeChangeAction": {
            const timestamp = new Date();
            const payload: ModeChange[] = groupedActions[type].map((action) => {
              return {
                timestamp,
                mode: action.mode,
                enabled: action.enabled,
                description: action.description,
                originVideoId: mc.videoId,
                originChannelId: mc.channelId,
              };
            });

            await ModeChangeModel.insertMany(payload, insertOptions);
            break;
          }
          case "addPlaceholderItemAction": {
            const payload: Placeholder[] = groupedActions[type].map(
              (action) => {
                return {
                  timestamp: action.timestamp,
                  id: action.id,
                  originVideoId: mc.videoId,
                  originChannelId: mc.channelId,
                };
              }
            );

            await PlaceholderModel.insertMany(payload, insertOptions);
            break;
          }
          case "replaceChatItemAction": {
            const replacementItems = groupedActions[type].map(
              (act) => act.replacementItem
            );
            const groupedItems = groupBy(replacementItems, "type");
            const itemTypes = Object.keys(groupedItems) as Action["type"][];

            for (const itemType of itemTypes) {
              switch (itemType) {
                case "addChatItemAction": {
                  const payload: Chat[] = groupedItems[itemType].map((item) => {
                    const normMessage = stringify(
                      item.message!,
                      stringifyOptions
                    );
                    const normMembership = normalizeMembership(item.membership);
                    return {
                      timestamp: item.timestamp,
                      id: item.id,
                      message: normMessage,
                      authorName: item.authorName,
                      authorChannelId: item.authorChannelId,
                      membership: normMembership,
                      isVerified: item.isVerified,
                      isOwner: item.isOwner,
                      isModerator: item.isModerator,
                      originVideoId: mc.videoId,
                      originChannelId: mc.channelId,
                    };
                  });
                  // videoLog("replaceChat:", payload?.length);
                  await ChatModel.insertMany(payload, insertOptions);
                  break;
                }
                case "addSuperChatItemAction": {
                  const payload: SuperChat[] = groupedItems[itemType].map(
                    (item) => {
                      const normMessage =
                        item.message && item.message.length > 0
                          ? stringify(item.message, stringifyOptions)
                          : null;
                      return {
                        timestamp: item.timestamp,
                        id: item.id,
                        message: normMessage,
                        purchaseAmount: item.amount,
                        currency: item.currency,
                        significance: item.significance,
                        color: item.color,
                        authorName: item.authorName,
                        authorChannelId: item.authorChannelId,
                        originVideoId: mc.videoId,
                        originChannelId: mc.channelId,
                      };
                    }
                  );
                  videoLog("<!> replaceSuperChat:", payload);
                  // TODO
                  // await SuperChatModel.insertMany(payload, insertOptions);
                  break;
                }
                case "addPlaceholderItemAction": {
                  const payload: Placeholder[] = groupedItems[itemType].map(
                    (item) => {
                      return {
                        timestamp: item.timestamp,
                        id: item.id,
                        originVideoId: mc.videoId,
                        originChannelId: mc.channelId,
                      };
                    }
                  );
                  // videoLog("<!> replacePlaceholder:", payload.length);
                  await PlaceholderModel.insertMany(payload, insertOptions);
                }
              }
            }
            break;
          }
          case "addPollResultAction": {
            const payload = groupedActions[type].map((action) => {
              return {
                id: action.id,
                question: action.question,
                total: action.total,
                choices: action.choices,
                originVideoId: mc.videoId,
                originChannelId: mc.channelId,
              };
            });
            // videoLog("<!> pollResult", JSON.stringify(payload));#
            // TODO: await Poll.insertMany(payload, insertOptions);
          }
          // case "addViewerEngagementMessageAction":
          // case "showPanelAction":
          // case "closePanelAction":
          // case "removeBannerAction":
          // case "showPollPanelAction":
          // case "updatePollAction":
          // case "addMembershipTickerAction":
          // case "addSuperChatTickerAction":
          // case "addSuperStickerTickerAction":
          // case "membershipGiftPurchaseAction":
          // case "membershipGiftRedemptionAction":
          // case "showTooltipAction":
          //   break;
          // default: {
          //   const _exhaust: never = type;
          //   break;
          // }
        }
      } catch (err) {
        // insertedDocs: []
        // result: BulkWriteResult,
        // writeErrors: WriteError
        // code: number
        stats.errors += 1;

        if (err instanceof MongoError) {
          if (err.code === 11000) {
            videoLog(
              `DUPES ${(err as any).writeErrors?.length || 0} while handling ${
                (err as any).insertedDocs?.length || 0
              } ${type}s`
            );
            continue;
          } else {
            videoLog(
              `<!> Unrecognized mongo error: code=${err.code} msg=${err.errmsg} labels=${err.errorLabels} type=${type}`
            );
          }
        } else if (err instanceof FetchError) {
          // getaddrinfo ENOTFOUND mongo
          videoLog("<!> FetchError", err, type);
        } else if (err instanceof Error) {
          videoLog("<!> Unrecognized Error", err, err.stack, type);
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

  videoLog(`START after=${randomTimeoutMs}ms`);

  // iterate over live chat
  try {
    for await (const { actions } of mc.iterate()) {
      if (actions.length === 0) continue;
      await handleActions(actions);
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
    videoLog("<!> [FATAL]", err);
    throw err;
  }

  videoLog(`END`);
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
