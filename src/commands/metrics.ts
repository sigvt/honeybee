import BanAction from "../models/BanAction";
import Chat from "../models/Chat";
import DeleteAction from "../models/DeleteAction";
import SuperChat from "../models/SuperChat";
import { initMongo } from "../modules/db";
import { getQueueInstance } from "../modules/queue";
import { Stats } from "../worker";

export async function metrics() {
  const disconnect = await initMongo();
  const queue = getQueueInstance({ isWorker: false });

  async function printMetrics() {
    const chat = await Chat.estimatedDocumentCount();
    const superchat = await SuperChat.estimatedDocumentCount();
    const ban = await BanAction.estimatedDocumentCount();
    const deletion = await DeleteAction.estimatedDocumentCount();

    const { active, waiting, delayed, failed, succeeded } =
      await queue.checkHealth();

    const activeJobs = await queue.getJobs("active", { start: 0, end: 300 });

    let warmingUp = 0;
    for (const job of activeJobs) {
      const progress: Stats = job.progress;
      if (progress.isWarmingUp) warmingUp += 1;
    }
    const realActive = active - warmingUp;

    const metrics = {
      chat,
      superchat,
      ban,
      deletion,
      active: realActive,
      warmingUp,
      waiting,
      delayed,
      failed,
      succeeded,
    };

    console.log(
      Object.entries(metrics)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")
    );
  }

  // const lastId = await DeleteAction.findOne({}, { _id: 1 }).sort({
  //   $natural: -1,
  // });
  // const stream = DeleteAction.find(
  //   { _id: { $gt: lastId._id } },
  //   { originChannelId: 1 },
  //   {
  //     tailable: true,
  //     numberOfRetries: -1,
  //   }
  // )
  //   .sort({ $natural: 1 })
  //   .limit(1)
  //   .cursor();

  // stream.on("data", (data: any) => {
  //   console.log(data);
  // });

  process.on("SIGINT", async () => {
    await queue.close();
    await disconnect();
    process.exit(0);
  });

  process.stdin.on("readable", () => {
    while (process.stdin.read() !== null) {
      printMetrics();
    }
  });
}
