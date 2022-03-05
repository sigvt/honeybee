import clc from "cli-color";
import clui from "clui";
const { Line, LineBuffer, Sparkline } = clui;
import { Stats } from "../interfaces";
import BanAction from "../models/BanAction";
import Chat from "../models/Chat";
import DeleteAction from "../models/Deletion";
import Membership from "../models/Membership";
import Milestone from "../models/Milestone";
import Placeholder from "../models/Placeholder";
import SuperChat from "../models/SuperChat";
import SuperSticker from "../models/SuperSticker";
import { initMongo } from "../modules/db";
import { getQueueInstance } from "../modules/queue";
import { DeltaCollection, timeoutThen } from "../util";

const REFRESH_INTERVAL = Number(process.env.REFRESH_INTERVAL || 10);

export async function health() {
  const disconnect = await initMongo();
  const queue = getQueueInstance({ isWorker: false });

  process.on("SIGINT", async () => {
    await queue.close();
    await disconnect();
    process.exit(0);
  });

  const col = new DeltaCollection(60);

  col.addRecord("chat", () => Chat.estimatedDocumentCount());
  col.addRecord("superchat", () => SuperChat.estimatedDocumentCount());
  col.addRecord("supersticker", () => SuperSticker.estimatedDocumentCount());
  col.addRecord("membership", () => Membership.estimatedDocumentCount());
  col.addRecord("milestone", () => Milestone.estimatedDocumentCount());
  col.addRecord("placeholder", () => Placeholder.estimatedDocumentCount());
  col.addRecord("ban", () => BanAction.estimatedDocumentCount());
  col.addRecord("deletion", () => DeleteAction.estimatedDocumentCount());

  while (true) {
    const queueHealth = await queue.checkHealth();
    const activeJobs = await queue.getJobs("active", { start: 0, end: 300 });

    let nbWarmingUp = 0;
    let nbTotal = 0;
    for (const job of activeJobs) {
      nbTotal += 1;
      const progress: Stats = job.progress;
      if (progress.isWarmingUp) nbWarmingUp += 1;
    }
    const nbActive = nbTotal - nbWarmingUp;

    await col.refresh();

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

    const COLUMN_WIDTH = 14;
    outputBuffer.addLine(
      new Line()
        .column("Active", COLUMN_WIDTH, [clc.cyan])
        .column("WarmingUp", COLUMN_WIDTH, [clc.cyan])
        .column("Delayed", COLUMN_WIDTH, [clc.cyan])
        .column("Waiting", COLUMN_WIDTH, [clc.cyan])
        .fill()
    );

    outputBuffer.addLine(
      new Line()
        .column(nbActive.toString(), COLUMN_WIDTH)
        .column(nbWarmingUp.toString(), COLUMN_WIDTH)
        .column(queueHealth.delayed.toString(), COLUMN_WIDTH)
        .column(queueHealth.waiting.toString(), COLUMN_WIDTH)
        .fill()
    );

    outputBuffer.addLine(new Line().fill());

    outputBuffer.addLine(
      new Line()
        .column("Chat", COLUMN_WIDTH, [clc.cyan])
        .column("SuperChat", COLUMN_WIDTH, [clc.cyan])
        .column("SuperSticker", COLUMN_WIDTH, [clc.cyan])
        .column("Membership", COLUMN_WIDTH, [clc.cyan])
        .column("Milestone", COLUMN_WIDTH, [clc.cyan])
        .column("Placeholder", COLUMN_WIDTH, [clc.cyan])
        .column("Ban", COLUMN_WIDTH, [clc.cyan])
        .column("Deletion", COLUMN_WIDTH, [clc.cyan])
        .fill()
    );

    const columns = [
      "chat",
      "superchat",
      "supersticker",
      "membership",
      "milestone",
      "placeholder",
      "ban",
      "deletion",
    ];

    outputBuffer.addLine(
      columns
        .reduce(
          (line, name) =>
            line.column(
              Intl.NumberFormat().format(col.get(name)!.current!),
              COLUMN_WIDTH
            ),
          new Line()
        )
        .fill()
    );

    outputBuffer.addLine(
      columns
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

    columns.forEach((name: string) => {
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
}
