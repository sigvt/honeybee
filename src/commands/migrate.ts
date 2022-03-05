import { stringify } from "masterchat";
import Chat from "../models/Chat";
import SuperChat from "../models/SuperChat";
import { initMongo } from "../modules/db";
import { timeoutThen } from "../util";

export async function migrate(argv: any) {
  console.log("connecting to db");
  const disconnect = await initMongo();

  // TODO
  // normalize membership info (same as membership table)
  await normalizeMembership();

  // normalize message
  // await normalizeMessage();

  // zap author photo column
  // await zapAuthorPhoto();

  // zap timestampUsec column
  // await zapTimestampUsec();

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

async function normalizeMembership() {
  console.log("normalizeMembership");

  let nbIterations = 0;

  for await (const doc of Chat.find(
    {
      _id: { $gte: "604dd5eca1fabd828af864df" },
      membership: { $exists: true },
    },
    { membership: 1 }
  )) {
    nbIterations += 1;
    if (nbIterations % 1_000_000 == 0) {
      console.log(doc._id);
    }

    // process
    const membership = doc.membership;
    if (!membership) {
      console.log("!membership", membership);
      process.exit(1);
    }

    // skip already normalized docs
    if (typeof membership === "string") continue;

    // {"thumbnail":"https:\/\/yt3.ggpht.com\/q9byWr1vaTCtgfB9WykJosrKhauNfAGBw55QKxLcATgmZHyANcAi-zG6eHNea9u6a4NHdhtD3fU=s32-c-k","status":"Member","since":"1 month"}
    const { status, thumbnail, since } = membership;
    if (status !== "Member" && status !== "New member") {
      console.log("!malformed status", membership);
      process.exit(1);
    }

    doc.membership = since ?? "new";

    console.log(doc);

    // doc.save();
  }
  process.stdout.write("\n");
}

async function normalizeMessage() {
  console.log("normalizeMessage");

  let nbIterations = 0;

  for await (const doc of Chat.find(
    {
      // _id: { $gt: "a" },
      message: { $exists: true },
    },
    { message: 1 }
  )) {
    nbIterations += 1;
    if (nbIterations % 1_000_000 == 0) {
      console.log(doc._id);
    }

    // process
    const message = doc.message;

    if (typeof message !== "object") {
      console.log("!type mismatch", doc);
      process.exit(1);
    }

    const normMessage = stringify(message, {
      spaces: false,
      emojiHandler: (run) => {
        const { emoji } = run;
        const term = emoji.isCustomEmoji
          ? `\uFFF9${emoji.shortcuts[emoji.shortcuts.length - 1]}\uFFFB`
          : emoji.emojiId;
        return term;
      },
    });

    doc.message = normMessage;

    console.log(doc);

    process.exit(1);
    // doc.save();
  }
  process.stdout.write("\n");
}

async function zapAuthorPhoto() {
  console.log("zapAuthorPhoto");

  let nbIterations = 0;

  for await (const doc of Chat.find(
    {
      // _id: { $gt: "a" },
      authorPhoto: { $exists: true },
    },
    { authorPhoto: 1 }
  )) {
    nbIterations += 1;
    if (nbIterations % 1_000_000 == 0) {
      console.log(doc._id);
    }

    // process
    (doc as any).authorPhoto = undefined;

    console.log(doc);

    process.exit(1);
    // doc.save();
  }
  process.stdout.write("\n");
}

async function zapTimestampUsec() {
  console.log("zapTimestampUsec");

  let nbIterations = 0;

  for await (const doc of Chat.find(
    {
      // _id: { $gt: "a" },
      timestampUsec: { $exists: true },
    },
    { timestampUsec: 1, timestamp: 1 }
  )) {
    nbIterations += 1;
    if (nbIterations % 1_000_000 == 0) {
      console.log(doc._id);
    }

    // process
    if (!doc.timestamp) {
      console.log("!timestamp", doc);
      process.exit(1);
    }

    doc.timestampUsec = undefined;

    console.log(doc);

    process.exit(1);
    // doc.save();
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
