const mongoose = require("mongoose");
const Chat = require("../lib/models/Chat.js").default;
const Deletion = require("../lib/models/Deletion.js").default;
const BanAction = require("../lib/models/BanAction.js").default;

async function main() {
  await mongoose.connect("mongodb://localhost/honeybee");

  Deletion.watch([
    {
      $match: { operationType: "insert", "fullDocument.retracted": false },
    },
  ]).on("change", async ({ fullDocument }) => {
    const chat = await Chat.findOne({ id: fullDocument.targetId });
    console.log("deleted", chat);
  });

  BanAction.watch([
    {
      $match: { operationType: "insert" },
    },
  ]).on("change", async ({ fullDocument }) => {
    const chat = await Chat.findOne({
      authorChannelId: fullDocument.channelId,
    });
    console.log("banned", chat);
  });
}

main();
