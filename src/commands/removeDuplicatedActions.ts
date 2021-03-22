import { initMongo } from "../modules/db";
import BanAction from "../models/BanAction";

export async function removeDuplicatedActions(argv: any) {
  const disconnect = await initMongo();

  const aggregate = await BanAction.aggregate([
    {
      $group: {
        _id: { channelId: "$channelId", originVideoId: "$originVideoId" },
        uniqueIds: { $addToSet: "$_id" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ]);

  let nbRemoved = 0;
  for (const res of aggregate) {
    const records = await BanAction.where("_id")
      .in(res.uniqueIds)
      .select(["_id"]);

    const toRemove = records.slice(1);
    nbRemoved += toRemove.length;
    // await BanAction.deleteMany(records.slice(1));
  }

  console.log(`removed`, nbRemoved);

  await disconnect();
}
