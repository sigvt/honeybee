#!/usr/local/bin/node --experimental-specifier-resolution=node
// experimental flags cannot be passed with /usr/bin/env

import yargs from "yargs";
import { removeDuplicatedActions } from "./commands/cleanup";
import { health } from "./commands/health";
import { metrics } from "./commands/metrics";
import { migrate } from "./commands/migrate";
import { runScheduler } from "./commands/scheduler";
import { runWorker } from "./commands/worker";
import { runManager } from "./commands/manager";
import { inspect } from "./commands/inspect";
import { stream } from "./commands/stream";

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
  .command("scheduler", "start scheduler", runScheduler)
  .command("worker", "start worker", runWorker)
  .command("manager", "start manager", runManager)
  .command("health", "show real-time cluster status", health)
  .command("metrics", "Telegraf metrics endpoint", metrics)
  .command("cleanupDupes", "remove duplicated actions", removeDuplicatedActions)
  .command("migrateChat", "migrate datetime format", migrate)
  .command("inspect", "migrate datetime format", inspect)
  .command("stream", "stream events", stream)
  .demandCommand(1).argv;
