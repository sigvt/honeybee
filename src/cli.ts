#!/usr/bin/env node

import yargs from "yargs";
import { inspectChat } from "./commands/inspectChat";
import { migrateDatetime } from "./commands/migrateDatetime";
import { migrateJsonl } from "./commands/migrateJsonl";
import { removeDuplicatedActions } from "./commands/removeDuplicatedActions";
import { showClusterHealth } from "./commands/showClusterHealth";
import { runScheduler } from "./scheduler";
import { runWorker } from "./worker";

process.on("unhandledRejection", () => {
  process.exit(1);
});

process.on("SIGINT", () => {
  process.exit(1);
});

yargs(process.argv.slice(2))
  .scriptName("honeybee")
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
  .command("health", "show cluster health", showClusterHealth)
  .command(
    "removeDuplicatedActions",
    "remove duplicated actions",
    removeDuplicatedActions
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
  .command("migrateDatetime", "migrate datetime format", migrateDatetime)
  .command("scheduler", "start scheduler", runScheduler)
  .command("worker", "start worker", runWorker)
  .demandCommand(1).argv;
