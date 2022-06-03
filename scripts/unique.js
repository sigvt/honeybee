#!/usr/bin/env node

const mongoose = require("mongoose");
const chalk = require("chalk");
const Chat = require("../lib/models/Chat.js").default;
const SuperChat = require("../lib/models/SuperChat.js").default;
const Deletion = require("../lib/models/Deletion.js").default;
const BanAction = require("../lib/models/BanAction.js").default;
const toVideoId = require("masterchat").toVideoId;

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost/honeybee";

function countUnique({ match, groupBy }) {
  console.log(match);
  return SuperChat.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: `$${groupBy}`,
        count: { $count: {} },
      },
    },
  ]);
}

async function main(argv) {
  console.log("connecting");
  await mongoose.connect(MONGO_URI);

  // const query = toVideoId(argv[0]);
  console.log("connected");

  const result = await countUnique({
    match: {
      originChannelId: "UC8rcEBzJSleTkf_-agPM20g",
      timestamp: {
        $gte: new Date(Date.UTC(2021, 0, 1)),
        $lt: new Date(Date.UTC(2022, 2, 1)),
      },
    },
    groupBy: "authorChannelId",
  });

  console.log(result);

  mongoose.disconnect();
}

main(process.argv.slice(2));
