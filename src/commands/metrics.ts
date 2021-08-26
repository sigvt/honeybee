import BanAction from "../models/BanAction";
import Chat from "../models/Chat";
import DeleteAction from "../models/DeleteAction";
import SuperChat from "../models/SuperChat";
import { initMongo } from "../modules/db";
import { getQueueInstance } from "../modules/queue";
import { groupBy } from "../util";
import { Stats } from "../worker";

// https://docs.influxdata.com/influxdb/v1.8/write_protocols/line_protocol_tutorial/

const INFLUX_MEASUREMENT = "honeybee";

const lastIdMap = new Map<string, string>();

async function printInfluxLog(
  fields: { [key: string]: number },
  {
    tags = {},
  }: {
    tags?: { [key: string]: string };
  } = {}
) {
  const tagSet = Object.entries(tags)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  const fieldSet = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}i`)
    .join(",");
  const timestamp = Date.now() * 1000 ** 2;
  console.log(
    `${INFLUX_MEASUREMENT}${
      tagSet.length > 0 ? "," : ""
    }${tagSet} ${fieldSet} ${timestamp}`
  );
}

async function logCounts(key: string, model: any) {
  let lastId = lastIdMap.get(key);
  if (!lastId) {
    lastId = (
      await model.findOne({}, { _id: 1 }).sort({
        $natural: -1,
      })
    )._id;
    lastIdMap.set(key, lastId!);
  }

  const records = await model.find(
    { _id: { $gt: lastId } },
    { originChannelId: 1 }
  );

  if (records.length > 0) {
    const groups = groupBy<any, any, any>(records, "originChannelId");
    for (const [chId, records] of Object.entries(groups)) {
      printInfluxLog({ [key]: records.length }, { tags: { channel: chId } });
    }
    lastIdMap.set(key, records[records.length - 1]._id);
  }
}

export async function metrics() {
  const disconnect = await initMongo();
  const queue = getQueueInstance({ isWorker: false });

  async function printMetrics() {
    // const chat = await Chat.estimatedDocumentCount();
    // const superchat = await SuperChat.estimatedDocumentCount();

    await logCounts("deletion", DeleteAction);
    await logCounts("ban", BanAction);
    await logCounts("superchat", SuperChat);
    await logCounts("chat", Chat);

    const { active, waiting, delayed, failed } = await queue.checkHealth();

    const activeJobs = await queue.getJobs("active", { start: 0, end: 300 });

    let warmingUp = 0;
    for (const job of activeJobs) {
      const progress: Stats = job.progress;
      if (progress.isWarmingUp) warmingUp += 1;
    }
    const realActive = active - warmingUp;

    const metrics = {
      active: realActive,
      warmingUp,
      waiting,
      delayed,
      failed,
    };

    printInfluxLog(metrics);
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
