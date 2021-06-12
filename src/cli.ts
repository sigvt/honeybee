#!/usr/bin/env node

import yargs from "yargs";
import { migrateChat } from "./commands/migrateChat";
import { removeDuplicatedActions } from "./commands/removeDuplicatedActions";
import { showClusterHealth } from "./commands/showClusterHealth";
import { runScheduler } from "./scheduler";
import { runWorker } from "./worker";

process.on("unhandledRejection", (err) => {
  console.log("CLI got unhandledRejection", err);
  process.exit(1);
});

process.on("uncaughtException", async (err) => {
  console.log("CLI got uncaughtException", err);
  process.exit(1);
});

process.on("SIGINT", (err) => {
  console.log("Keyboard interrupt");
  process.exit(0);
});

yargs(process.argv.slice(2))
  .scriptName("honeybee")
  .command("health", "show cluster health", showClusterHealth)
  .command("cleanupDupes", "remove duplicated actions", removeDuplicatedActions)
  .command("migrateChat", "migrate datetime format", migrateChat)
  .command("scheduler", "start scheduler", runScheduler)
  .command("worker", "start worker", runWorker)
  .demandCommand(1).argv;
