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
  for (const agg of aggregate) {
    const records = await BanAction.where("_id")
      .in(agg.uniqueIds)
      .select(["timestampUsec"]);
    console.log(records);
    // process.exit(0);
  }

  await disconnect();
}
