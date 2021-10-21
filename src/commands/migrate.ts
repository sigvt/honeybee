import { initMongo } from "../modules/db";
import Chat from "../models/Chat";
import SuperChat from "../models/SuperChat";
import { timeoutThen } from "../util";
import chalk from "chalk";

export async function migrate(argv: any) {
  console.log("connecting to db");
  const disconnect = await initMongo();

  // await normalizeMessage();
  // await migrateCurrencySymbol();

  console.log("assuring all processes to be finished");
  await timeoutThen(5000);

  console.log("disconnecting from db");
  await disconnect();
}

async function migrateCurrencySymbol() {
  const SYMBOL_TO_TLS_MAP: Record<string, string> = {
    "£": "GBP",
    "¥": "JPY",
    "₩": "KRW",
    "₪": "ILS",
    "€": "EUR",
    "₱": "PHP",
    "₹": "INR",
    "JP¥": "JPY",
    $: "USD",
    A$: "AUD",
    CA$: "CAD",
    HK$: "HKD",
    MX$: "MXN",
    NT$: "TWD",
    NZ$: "NZD",
    R$: "BRL",
  };

  function toTLS(symbolOrTls: string): string {
    return SYMBOL_TO_TLS_MAP[symbolOrTls] ?? symbolOrTls;
  }

  let nbIterations = 0;

  console.log("migrateCurrencySymbol");
  for await (const doc of SuperChat.find(
    {
      // _id: { $gt: "a" },
    },
    { currency: 1 }
  )) {
    nbIterations += 1;
    if (nbIterations % 10000000 === 0) {
      console.log(doc._id);
    }

    const newCur = toTLS(doc.currency);
    if (newCur !== doc.currency) {
      // console.log(newCur, doc.currency);
      // process.exit(0);
      doc.currency = newCur;
      doc.save();
    }
  }
}

async function normalizeMessage() {
  console.log("normalizeMessage");

  let nbIterations = 0;

  for await (const doc of SuperChat.find(
    {
      // _id: { $gt: "a" },
    },
    { message: 1 }
  )) {
    nbIterations += 1;
    if (nbIterations % 1_000_000 == 0) {
      console.log(doc._id);
    }

    if (Array.isArray(doc.message) && doc.message.length === 0) {
      doc.message = null;
      doc.save();
    }
  }
  process.stdout.write("\n");
}

// MEMO:
// db.superchats.update({}, {$unset: {authorPhoto: 1}}, false, true);
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
