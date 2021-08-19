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
    let nbWarmingUp = 0;
    for (const job of activeJobs) {
      const progress: Stats = job.progress;
      if (progress.isWarmingUp) nbWarmingUp += 1;
    }
    const realActive = active - nbWarmingUp;

    const metrics = {
      chat,
      superchat,
      ban,
      deletion,
      active: realActive,
      warmingUp: nbWarmingUp,
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
