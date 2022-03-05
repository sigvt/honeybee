import { stringify, YTEmojiRun } from "masterchat";
import Chat from "../models/Chat";
import Milestone from "../models/Milestone";
import SuperChat from "../models/SuperChat";
import { initMongo } from "../modules/db";
import { timeoutThen } from "../util";

export async function migrate(argv: any) {
  console.log("connecting to db");
  const disconnect = await initMongo();

  // normalize message and membership
  // await normalize();

  // normalize currency symbol
  // await normalizeCurrencySymbol();

  console.log("assuring all processes to be finished");
  await timeoutThen(5000);

  console.log("disconnecting from db");
  await disconnect();
}

async function normalizeCurrencySymbol() {
  console.log("normalizeCurrencySymbol");

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

async function normalize() {
  console.log("normalize");

  let nbIterations = 0;

  function emojiHandler({ emoji }: YTEmojiRun) {
    return emoji.isCustomEmoji
      ? `\uFFF9${emoji.shortcuts[emoji.shortcuts.length - 1]}\uFFFB`
      : emoji.emojiId;
  }

  const stringifyOption = {
    spaces: false,
    emojiHandler,
  };

  for await (const doc of Milestone.find(
    {
      // _id: { $gt: "608a86b7bce6012bbcfac608" },
      // timestamp: {
      //   $lt: new Date("2022-01-18T03:20:15.943Z"),
      // },
      message: { $exists: false },
    },
    {
      message: 1,
    }
  )) {
    // process

    console.log(doc);
    doc.message = null;
    // message
    // if (typeof doc.message === "object" && doc.message !== null) {
    //   const normMessage = stringify(doc.message, stringifyOption);

    //   doc.message = normMessage;
    // }

    // membership
    // skip already normalized docs
    // if (doc.membership && typeof doc.membership !== "string") {
    //   const { status, since } = doc.membership;
    //   if (status !== "Member" && status !== "New member") {
    //     console.log("!malformed status", doc);
    //     process.exit(1);
    //   }

    //   doc.membership = since ?? "new";
    // }

    nbIterations += 1;
    if (nbIterations % 1_000_000 == 0) {
      console.log(doc._id, new Date());
      console.log(doc);
    }

    doc.save();
  }

  process.stdout.write("\n");
}

/**
MEMO:

# Drop column
# https://docs.mongodb.com/manual/tutorial/update-documents-with-aggregation-pipeline/
db.chats.updateMany({}, [{ $unset: ["authorPhoto", "timestampUsec"] }]);
db.superchats.updateMany({}, [{ $unset: "authorPhoto" }]);

# Add column
const aggregate = await BanAction.aggregate([
  {
    $addFields: {
      created: {
        $toDate: "$timestampUsec",
      },
    },
  },
]);

# Index
db.chats.createIndex({timestamp: 1})
db.chats.getIndexes()
db.chats.createIndex({message: "text"})

# Complex query
db.chats.find(
  {timestamp: {$gte: new Date('2021-07-01')}, authorChannelId: 'a', originChannelId: 'b'},
  {timestamp: 1, membership: 1, message: 1}
).sort({timestamp: -1}).limit(1)
*/
