import clc from "cli-color";
import { Line, LineBuffer, Sparkline } from "clui";
import BanAction from "../models/BanAction";
import Chat from "../models/Chat";
import DeleteAction from "../models/DeleteAction";
import { initMongo } from "../modules/db";
import { getQueueInstance } from "../modules/queue";
import { DeltaCollection, timeoutThen } from "../util";

const REFRESH_INTERVAL = Number(process.env.REFRESH_INTERVAL || 10);

export async function showClusterHealth() {
  const disconnect = await initMongo();
  const queue = getQueueInstance({ isWorker: false });

  process.on("SIGINT", async () => {
    await queue.close();
    await disconnect();
    process.exit(0);
  });

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
}
