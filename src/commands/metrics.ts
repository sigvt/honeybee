import BanAction from "../models/BanAction";
import Chat from "../models/Chat";
import DeleteAction from "../models/DeleteAction";
import SuperChat from "../models/SuperChat";
import { initMongo } from "../modules/db";
import { getQueueInstance } from "../modules/queue";
import { channels } from "../data/channels";
import { groupBy } from "../util";
import { CURRENCY_TO_TLS_MAP } from "../data/currency";
import { Stats } from "../interfaces";

// https://docs.influxdata.com/influxdb/v1.8/write_protocols/line_protocol_tutorial/

const INFLUX_MEASUREMENT = "honeybee";

const lastIdMap = new Map<string, string>();

interface InfluxPayload {
  fields: { [key: string]: string | number };
  tags?: { [key: string]: string | number };
}

type AggregatorModule = (records: any, key: string) => Generator<InfluxPayload>;

function normalize(input: string): string {
  return input.replace(/[".,'-/]/g, "").replace(/\s/g, "-");
}

async function printInfluxLog({ fields, tags = {} }: InfluxPayload) {
  const tagSet = Object.entries(tags)
    .map(([k, v]) => {
      if (typeof v === "string") {
        return `${k}=${normalize(v)}`;
      }
      return `${k}=${v}`;
    })
    .join(",");
  const fieldSet = Object.entries(fields)
    .map(([k, v]) => {
      if (typeof v === "string") {
        return `${k}="${v.replace(/"/g, "")}"`;
      } else {
        return `${k}=${v}i`;
      }
    })
    .join(",");
  const timestamp = Date.now() * 1000 ** 2;
  console.log(
    `${INFLUX_MEASUREMENT}${
      tagSet.length > 0 ? "," : ""
    }${tagSet} ${fieldSet} ${timestamp}`
  );
}

function* groupByChannel(records: any, key: string): Generator<InfluxPayload> {
  const groups = groupBy<any, any, any>(records, "originChannelId");
  for (const [chId, records] of Object.entries(groups)) {
    const channel = channels[chId];
    const channelName = channel ? channel["name.en"].toLowerCase() : chId;
    const affiliation = channel ? channel.affiliation.toLowerCase() : undefined;
    yield {
      fields: { [key]: records.length },
      tags: {
        channel: channelName,
        ...(affiliation ? { affiliation } : undefined),
      },
    };
  }
}

function* groupByCountry(records: any, key: string) {
  const groups = groupBy<any, any, any>(records, "currency");
  for (const [currency, records] of Object.entries(groups)) {
    const country = CURRENCY_TO_TLS_MAP[currency];
    yield {
      fields: { [key]: records.length },
      tags: {
        country,
      },
    };
  }
}

async function logCounts(
  key: string,
  model: any,
  {
    agg = groupByChannel,
    criteria,
    projection = { originChannelId: 1 },
  }: {
    agg?: AggregatorModule;
    criteria?: Record<string, any>;
    projection?: Record<string, 1>;
  } = {}
) {
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
    { _id: { $gt: lastId }, ...criteria },
    projection
  );

  if (records.length > 0) {
    for (const payload of agg(records, key)) {
      printInfluxLog(payload);
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

    await logCounts("deletion", DeleteAction, {
      criteria: { retracted: false },
    });
    await logCounts("ban", BanAction);
    await logCounts("chat", Chat);
    await logCounts("superchat", SuperChat);
    await logCounts("superchat_country", SuperChat, {
      projection: { currency: 1 },
      agg: groupByCountry,
    });

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

    printInfluxLog({ fields: metrics });
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
