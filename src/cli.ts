import clc from "cli-color";
import { Line, LineBuffer, Sparkline } from "clui";
import fs from "fs";
import readline from "readline";
import yargs from "yargs";
import { initMongo } from "./db";
import BanAction from "./models/BanAction";
import Chat from "./models/Chat";
import DeleteAction from "./models/DeleteAction";
import { getQueueInstance } from "./queue";
import { Action, ReloadContinuationType } from "./types/chat";
import { DeltaCollection, normalizeVideoId, timeoutThen } from "./util";
import { iterateChat } from "./youtube/chat";
import { fetchContext } from "./youtube/context";
import { toSimpleChat } from "./youtube/util";

async function inspectChat(argv: any) {
  const id = normalizeVideoId(argv.videoId);

  // get web player context
  const context = await fetchContext(id);
  const { metadata } = context;

  // check if the video is valid
  if (!metadata) {
    console.log("video source is unavailable. wrong video id?");
    process.exit(1);
  }

  // check if the stream is live
  const isLiveChat = metadata.isLive;

  console.log("title:", metadata.title);

  if (!metadata.continuations) {
    console.log(
      "reload continuation not found. try again later or possibility it's a normal video."
    );
    process.exit(1);
  }

  const initialToken = metadata.continuations[ReloadContinuationType.All].token;

  const liveChatIter = iterateChat({
    token: initialToken,
    apiKey: context.apiKey,
    client: context.client,
    isLiveChat,
  });

  let chatQueue: string[] = [];
  let wait = 0;

  // live chat visualizer
  if (isLiveChat) {
    new Promise(async () => {
      while (true) {
        const timeout = Math.ceil(wait / (chatQueue.length + 1)) || 0;
        await new Promise((resolve) => setTimeout(resolve, timeout));
        wait = Math.max(0, wait - timeout);
        if (chatQueue.length > 0) {
          console.log(chatQueue.shift());
        }
      }
    });
  }

  // fetch chat
  for await (const { actions, delay } of liveChatIter) {
    console.log("incoming actions:", actions.length, "delay:", delay);
    if (actions.length > 0) {
      const simpleChat: string[] = toSimpleChat(actions);

      if (simpleChat.length > 0) {
        chatQueue = [...chatQueue, ...simpleChat];
      }

      wait += delay || 0;
    }

    if (isLiveChat) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.log("Live stream is over");
  process.exit(0);
}

async function showClusterStats() {
  const disconnect = await initMongo();
  const queue = getQueueInstance({ isWorker: false });

  process.on("SIGINT", async () => {
    console.log("Caught interrupt signal");

    await queue.close();
    await disconnect();

    process.exit(0);
  });

  const REFRESH_INTERVAL = 10;

  const col = new DeltaCollection(80);

  col.addRecord("chat", () => Chat.estimatedDocumentCount());
  col.addRecord("ban", () => BanAction.estimatedDocumentCount());
  col.addRecord("deletion", () => DeleteAction.estimatedDocumentCount());

  while (true) {
    const queueHealth = await queue.checkHealth();
    await col.fetch();

    const outputBuffer = new LineBuffer({
      x: 0,
      y: 0,
      width: "console",
      height: "console",
    });

    outputBuffer.addLine(
      new Line()
        .column(`honeybee cluster health [interval=${REFRESH_INTERVAL}s]`, 60, [
          clc.yellow,
        ])
        .fill()
    );

    outputBuffer.addLine(new Line().fill());

    const COLUMN_WIDTH = 20;
    outputBuffer.addLine(
      new Line()
        .column("Chat", COLUMN_WIDTH, [clc.cyan])
        .column("Ban", COLUMN_WIDTH, [clc.cyan])
        .column("Deletion", COLUMN_WIDTH, [clc.cyan])
        .column("Active", COLUMN_WIDTH, [clc.cyan])
        .column("Delayed", COLUMN_WIDTH, [clc.cyan])
        .column("Waiting", COLUMN_WIDTH, [clc.cyan])
        .fill()
    );

    outputBuffer.addLine(
      ["chat", "ban", "deletion"]
        .reduce(
          (line, name) =>
            line.column(
              Intl.NumberFormat().format(col.get(name)!.current!),
              COLUMN_WIDTH
            ),
          new Line()
        )
        .column(queueHealth.active.toString(), COLUMN_WIDTH)
        .column(queueHealth.delayed.toString(), COLUMN_WIDTH)
        .column(queueHealth.waiting.toString(), COLUMN_WIDTH)
        .fill()
    );

    outputBuffer.addLine(
      ["chat", "ban", "deletion"]
        .reduce(
          (line, name) =>
            line.column("+" + col.get(name)!.lastDelta, COLUMN_WIDTH, [
              clc.magentaBright,
            ]),
          new Line()
        )
        .fill()
    );

    outputBuffer.addLine(new Line().fill());

    ["chat", "ban", "deletion"].forEach((name: string) => {
      outputBuffer.addLine(
        new Line()
          .column(
            Sparkline(col.get(name)!.history, ` ${name}/${REFRESH_INTERVAL}s`),
            160
          )
          .fill()
      );
    });

    outputBuffer.addLine(new Line().fill());

    console.log(clc.erase.screen);
    outputBuffer.output();

    await timeoutThen(REFRESH_INTERVAL * 1000);
  }

  await disconnect();
  await queue.close();
}

type ActionWithOrigin = Action & {
  originVideoId: string;
  originChannelId: string;
};

async function normalizeRawMessage(argv: any) {
  const disconnect = await initMongo();

  for await (const doc of Chat.find()) {
    if (!doc.rawMessage) continue;
    if (doc.rawMessage[0] && "runs" in doc.rawMessage[0]) {
      doc.rawMessage = (doc.rawMessage[0] as any).runs;
      await doc.save();
      process.stdout.write(".");
    }
  }

  await disconnect();
}

async function removeDuplicatedActions(argv: any) {
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

async function migrateJsonl(argv: any) {
  const { input } = argv;

  const disconnect = await initMongo();

  console.log(`processing`, input);

  async function handleLine(line: string) {
    const action: Action | ActionWithOrigin = JSON.parse(line);

    // ignore action without origin
    if (!("originChannelId" in action && "originVideoId" in action)) {
      // console.log(`mising origin. skipped.`);
      return;
    }

    try {
      switch (action.type) {
        case "addChatItemAction": {
          // remove `message`
          delete (action as any).message;

          await Chat.create(action);
          // console.log(`chat ${chat._id}`);

          break;
        }
        case "markChatItemAsDeletedAction": {
          await DeleteAction.create(action);
          // console.log(`delete ${res._id}`);

          break;
        }
        case "markChatItemsByAuthorAsDeletedAction": {
          await BanAction.create(action);
          // console.log(`ban ${res._id}`);

          break;
        }
      }
    } catch (err) {
      console.log(`MIGRATION ERROR`, err.message, action);
    }
  }

  const readInterface = readline.createInterface({
    input: fs.createReadStream(input),
    output: process.stdout,
    terminal: false,
  });

  readInterface.on("line", async (line) => {
    try {
      await handleLine(line);
    } catch (err) {
      console.error(err.message);
    }
  });

  readInterface.on("close", () => {
    console.log("readline closed!");
  });
}

yargs(process.argv.slice(2))
  .scriptName("honeybee")
  .command("stats", "show cluster health", showClusterStats)
  .command(
    "inspect <videoId>",
    "inspect the live chat messages",
    (yargs) => {
      yargs.positional("videoId", {
        describe: "video id",
      });
    },
    inspectChat
  )
  .command(
    "migrateJsonl <input>",
    "migrate JSONL file",
    (yargs) => {
      yargs.positional("input", {
        describe: "jsonl file",
      });
    },
    migrateJsonl
  )
  .command("normalizeRawMessage", "normalizee rawMessage", normalizeRawMessage)
  .demandCommand(1).argv;
