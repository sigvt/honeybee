import fs from "fs";
import readline from "readline";
import { initMongo } from "../modules/db";
import BanAction from "../models/BanAction";
import Chat from "../models/Chat";
import DeleteAction from "../models/DeleteAction";
import { Action } from "../modules/youtube/types/chat";

type ActionWithOrigin = Action & {
  originVideoId: string;
  originChannelId: string;
};

export async function migrateJsonl(argv: any) {
  const { input } = argv;

  await initMongo();

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
