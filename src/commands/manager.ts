// from docker environment
// TF_VAR_do_token
// TF_VAR_do_ssh_keys
// TF_VAR_provision_key_path + volume mount

import assert from "assert";
import execa from "execa";
import schedule from "node-schedule";
import { JOB_CONCURRENCY, SHUTDOWN_TIMEOUT } from "../constants";
import { getQueueInstance } from "../modules/queue";

const TF_PROJECT_ROOT = process.env.TF_PROJECT_ROOT;
const PERM_WORKERS = Number(process.env.PERM_WORKERS ?? 0);

async function scaleNodes(totalWorkers: number = 1) {
  const args = [
    "apply",
    "-no-color",
    "-input=false",
    "-auto-approve",
    "-var",
    `do_total_workers=${totalWorkers}`,
  ];

  const subprocess = execa("terraform", args, {
    shell: true,
    cwd: TF_PROJECT_ROOT,
  });

  subprocess.stdout?.pipe(process.stdout);

  try {
    await subprocess;
  } catch (err) {
    console.log(err);
  }
}

export async function runManager() {
  assert(TF_PROJECT_ROOT);

  let previousWorkers: number | null = null;

  const queue = getQueueInstance({ isWorker: false });

  process.on("SIGTERM", async () => {
    console.log("quitting manager (SIGTERM) ...");

    try {
      await queue.close(SHUTDOWN_TIMEOUT);
    } catch (err) {
      console.log("bee-queue failed to shut down gracefully", err);
    }
    process.exit(0);
  });

  async function rearrange(invokedAt: Date) {
    console.log("@@@@@@@@ adjusting cluster size", invokedAt);

    const health = await queue.checkHealth();

    const totalJobs = health.active + health.delayed + health.waiting;
    const requiredWorkers = Math.ceil(totalJobs / JOB_CONCURRENCY + 0.3);
    const doWorkers = Math.max(requiredWorkers - PERM_WORKERS, 0);
    console.log(
      `applying new cluster settings: jobs=${totalJobs} required=${requiredWorkers} | perm=${PERM_WORKERS} do=${previousWorkers} -> ${doWorkers}`
    );

    // if (doWorkers !== previousWorkers)
    await scaleNodes(doWorkers);

    previousWorkers = doWorkers;
  }

  queue.on("ready", async () => {
    console.log(`manager has been started (concurrency: ${JOB_CONCURRENCY})`);

    schedule.scheduleJob("10 */1 * * *", rearrange);
    await rearrange(new Date());
  });
}
