import { initMongo } from "../modules/db";
import Chat from "../models/Chat";
import SuperChat from "../models/SuperChat";

// MEMO:
// const aggregate = await BanAction.aggregate([
//   {
//     $addFields: {
//       created: {
//         $toDate: "$timestampUsec",
//       },
//     },
//   },
// ]);
// db.chats.update({}, {$unset: {timestampUsec: 1}}, false, true);
// db.chats.createIndex({'timestamp': 1})
// db.chats.getIndexes()
// db.chats.find({timestamp: {$gte: new Date('2021-07-01')}, authorChannelId: '', originChannelId: ''}, {timestamp: 1, membership: 1, message: 1}).sort({timestamp: -1}).limit(1)

// Map from headerBackgroundColor to color name
export const SUPERCHAT_COLOR_MAP = {
  "4279592384": "blue",
  "4278237396": "lightblue",
  "4278239141": "green",
  "4294947584": "yellow",
  "4293284096": "orange",
  "4290910299": "magenta",
  "4291821568": "red",
} as const;

// Map from color to significance
export const SUPERCHAT_SIGNIFICANCE_MAP = {
  blue: 1,
  lightblue: 2,
  green: 3,
  yellow: 4,
  orange: 5,
  magenta: 6,
  red: 7,
} as const;

export async function migrateChat(argv: any) {
  console.log("connecting");
  const disconnect = await initMongo();

  let nbIterations = 0;
  let timeStarted = Date.now();

  console.log("rawMessage -> message");
  for await (const doc of Chat.find(
    { message: { $exists: false }, rawMessage: { $exists: true } },
    { rawMessage: 1 }
  )) {
    // @ts-ignore
    doc.message = doc.rawMessage;
    await doc.save();

    nbIterations += 1;
    if (nbIterations % 100000 == 0) {
      console.log(doc._id);
      const timeElasped = (Date.now() - timeStarted) / 1000 / 60;
      console.log(`iterations: ${nbIterations}`);
      console.log(`time elapsed: ${timeElasped} minutes`);
    }
  }

  console.log("purchase -> SuperChat");
  for await (const doc of Chat.find({ purchase: { $exists: true } })) {
    // {"headerTextColor":"3741319168","amount":150,"headerBackgroundColor":"4294947584","bodyTextColor":"3741319168","currency":"NT$","bodyBackgroundColor":"4294953512"}
    // @ts-ignore
    const purchase = doc.purchase;

    const color =
      SUPERCHAT_COLOR_MAP[
        purchase.headerBackgroundColor.toString() as keyof typeof SUPERCHAT_COLOR_MAP
      ];
    if (!color) {
      throw new Error("invalid color");
    }

    const significance = SUPERCHAT_SIGNIFICANCE_MAP[color];
    if (!significance) {
      throw new Error("invalid significance");
    }

    const sp = new SuperChat();
    sp.timestamp = doc.timestamp;
    sp.id = doc.id;
    sp.message = doc.message;
    sp.purchaseAmount = purchase.amount;
    sp.currency = purchase.currency;
    sp.color = color;
    sp.significance = significance;
    sp.authorName = doc.authorName;
    sp.authorChannelId = doc.authorChannelId;
    sp.authorPhoto = doc.authorPhoto;
    sp.originVideoId = doc.originVideoId;
    sp.originChannelId = doc.originChannelId;

    await sp.save();
    // await doc.remove();

    nbIterations += 1;
    if (nbIterations % 100000 == 0) {
      console.log(doc._id);
      const timeElasped = (Date.now() - timeStarted) / 1000 / 60;
      console.log(`iterations: ${nbIterations}`);
      console.log(`time elapsed: ${timeElasped} minutes`);
    }
  }

  await disconnect();
}
