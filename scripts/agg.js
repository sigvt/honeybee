#!/usr/bin/env node

const mongoose = require("mongoose");
const chalk = require("chalk");
const Chat = require("../lib/models/Chat.js").default;
const SuperChat = require("../lib/models/SuperChat.js").default;
const Deletion = require("../lib/models/Deletion.js").default;
const BanAction = require("../lib/models/BanAction.js").default;
const toVideoId = require("masterchat").toVideoId;

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost/honeybee";

function pprint(msg) {
  const { id, authorName, message, timestamp, originChannelId, originVideoId } =
    msg;
  console.log(
    chalk.gray(`[${timestamp.toLocaleString()}]`).padEnd(36, " ") +
      `${authorName}: ${message}`
  );
}

function lookupDeletedChats(channelId, limit = 20) {
  return Deletion.aggregate([
    {
      $match: { retracted: false, originChannelId: channelId },
    },
    { $sort: { timestamp: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "chats",
        localField: "targetId",
        foreignField: "id",
        as: "chat",
      },
    },
    { $project: { originVideoId: 1, "chat.message": 1, "chat.authorName": 1 } },
  ]);
}

function topSuperChatters(channelId) {
  return SuperChat.aggregate([
    {
      $match: {
        originChannelId: channelId,
        // timestamp: {
        //   $gte: new Date(Date.UTC(2021, 0, 1)),
        //   $lt: new Date(Date.UTC(2022, 2, 1)),
        // },
      },
    },
    {
      $addFields: {
        ts: {
          $dateTrunc: {
            date: "$timestamp",
            unit: "month",
            binSize: 1,
          },
        },
      },
    },
    {
      $group: {
        _id: "$authorChannelId",
        ts: { $first: "$ts" },
        // timestamp: { $first: "$timestamp" },
        count: { $count: {} },
      },
    },
    // {
    //   $group: {
    //     _id: "$ts",
    //     count: { $count: {} },
    //   },
    // },
    { $sort: { count: -1 } },
  ]);
}

function hiddenChats(videoId) {
  // Returns hidden chats
  return BanAction.aggregate([
    { $match: { originVideoId: videoId } },
    {
      $group: {
        _id: "$channelId",
        timestamp: { $last: "$timestamp" },
        count: { $count: {} },
      },
    },
    { $sort: { count: -1 } },
    // { $limit: 5 },
    {
      $lookup: {
        from: "chats",
        let: { cid: "$_id", ts: "$timestamp" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$originVideoId", videoId] },
                  { $eq: ["$authorChannelId", "$$cid"] },
                  {
                    $gte: [
                      "$timestamp",
                      {
                        $dateSubtract: {
                          startDate: "$$ts",
                          unit: "minute",
                          amount: 3,
                        },
                      },
                    ],
                  },
                  { $lte: ["$timestamp", "$$ts"] },
                ],
              },
            },
          },
          { $sort: { timestamp: 1 } },
          // { $limit: 5 },
          {
            $project: {
              message: 1,
              timestamp: 1,
              authorName: 1,
            },
          },
        ],
        as: "chats",
      },
    },
  ]);
}

async function pprintHiddenChats(videoId) {
  console.log("< Querying bonk records for video", videoId);

  const result = await hiddenChats(videoId);

  console.log(
    `< Found ${result.length} users being bonked ${result.reduce(
      (s, c) => s + c.count,
      0
    )} times`
  );

  // console.log(result[0]);
  for (const { timestamp, count, chats } of result) {
    console.log(`\n> user="${chats[0]?.authorName}" count=${count}`);
    for (const chat of chats) {
      console.log(chat.timestamp, chat.message);
    }
    console.log(timestamp, "[💀 this user has been bonked]");
  }
}

async function main(argv) {
  await mongoose.connect(MONGO_URI);

  const query = toVideoId(argv[0]);

  const result = await pprintHiddenChats(query);

  mongoose.disconnect();
}

main(process.argv.slice(2));
