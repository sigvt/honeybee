import BanAction from "../models/BanAction";
import Chat from "../models/Chat";
import DeleteAction from "../models/DeleteAction";
import SuperChat from "../models/SuperChat";
import { initMongo } from "../modules/db";

export async function stream() {
  const disconnect = await initMongo();

  process.on("SIGINT", async () => {
    await disconnect();
    process.exit(0);
  });

  const stream = Chat.watch();
  stream.on("change", (event) => {
    console.log(event.operationType, event.clusterTime, event._id);
  });
}
