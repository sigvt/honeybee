import chalk from "chalk";
import { Action, Run } from "../types/chat";
import { log } from "../util";

export function convertRunsToString(runs: Run[]): string {
  try {
    return runs
      .map((run) => {
        if (run.text) {
          return run.text;
        }
        if (run.emoji) {
          return (
            ":" + run.emoji.image.accessibility.accessibilityData.label + ":"
          );
        }
      })
      .join("");
  } catch (err) {
    log(err, runs);
    throw new Error("failed to render runs into string");
  }
}

export function toSimpleChat(actions: Action[]): string[] {
  const simpleChat: string[] = [];

  for (const action of actions) {
    switch (action.type) {
      case "addChatItemAction":
        if (action.rawMessage || action.purchase) {
          simpleChat.push(
            (action.rawMessage
              ? convertRunsToString(action.rawMessage)
              : "EMPTY MESSAGE") +
              (action.purchase
                ? " (" +
                  action.purchase.amount +
                  " " +
                  action.purchase.currency +
                  ")"
                : "")
          );
        }
        break;
      case "markChatItemsByAuthorAsDeletedAction":
        simpleChat.push(
          chalk.red("markChatItemsByAuthorAsDeletedAction: " + action.channelId)
        );
        break;
      case "markChatItemAsDeletedAction":
        simpleChat.push(
          chalk.yellow(
            "markChatItemAsDeletedAction: " + action.targetId,
            action.retracted ? "[retracted]" : "[deleted]"
          )
        );
        break;
    }
  }
  return simpleChat;
}
