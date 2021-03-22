import { initMongo } from "../modules/db";
import BanAction from "../models/BanAction";
import Chat from "../models/Chat";
import DeleteAction from "../models/DeleteAction";

// const aggregate = await BanAction.aggregate([
//   {
//     $addFields: {
//       created: {
//         $toDate: "$timestampUsec",
//       },
//     },
//   },
// ]);
// db.banactions.update({}, {$unset: {timestampUsec: 1}}, false, true);
// db.banactions.createIndex({'timestamp': 1})
// db.banactions.getIndexes()

export async function migrateDatetime(argv: any) {
  console.log("connecting");
  const disconnect = await initMongo();

  console.log("chat");
  let nbIterations = 0;
  let timeStarted = Date.now();

  for await (const doc of Chat.find(
    { timestamp: { $exists: false }, timestampUsec: { $exists: true } },
    { timestampUsec: 1 }
  )) {
    doc.timestamp = new Date(parseInt(doc.timestampUsec!, 10) / 1000);
    await doc.save();

    nbIterations += 1;
    if (nbIterations % 1000000 == 0) {
      console.log(doc._id);
      const timeElasped = (Date.now() - timeStarted) / 1000 / 60;
      console.log(`iterations: ${nbIterations}`);
      console.log(`time elapsed: ${timeElasped} minutes`);
    }
  }

  await disconnect();
}
