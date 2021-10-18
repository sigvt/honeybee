// from docker environment
// TF_VAR_token
// TF_VAR_ssh_keys
// TF_VAR_provision_key_path + volume mount

import assert from "assert";
import execa from "execa";
import schedule from "node-schedule";
import { JOB_CONCURRENCY, SHUTDOWN_TIMEOUT } from "../constants";
import { getQueueInstance } from "../modules/queue";

const TF_PROJECT_ROOT = process.env.TF_PROJECT_ROOT!;
const TF_KEY_PATH = process.env.TF_VAR_provision_key_path!;

const PERMANENT_WORKER_IP = process.env.PERMANENT_WORKER_IP?.split(",");
const PERMANENT_WORKER_SIZE = (PERMANENT_WORKER_IP?.length ?? 0) + 1;

async function scaleNodes(totalWorkers: number = 1) {
  const args = [
    "apply",
    "-no-color",
    "-input=false",
    "-auto-approve",
    "-var",
    `total_workers=${totalWorkers}`,
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

async function prune(ip: string) {
  const subprocess = execa(
    "ssh",
    [
      `root@${ip}`,
      "-o",
      "StrictHostKeyChecking no",
      "-i",
      TF_KEY_PATH,
      "--",
      "docker",
      "system",
      "prune",
      "-f",
    ],
    { shell: true, cwd: TF_PROJECT_ROOT }
  );

  subprocess.stdout?.pipe(process.stdout);

  try {
    await subprocess;
  } catch (err) {
    console.log(err);
  }
}

export async function runManager() {
  assert(TF_PROJECT_ROOT);
  assert(TF_KEY_PATH);

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
    const doWorkers = Math.max(requiredWorkers - PERMANENT_WORKER_SIZE, 0);
    console.log(
      `applying new cluster settings: jobs=${totalJobs} required=${requiredWorkers} | perm=${PERMANENT_WORKER_SIZE} do=${previousWorkers} -> ${doWorkers}`
    );

    await scaleNodes(doWorkers);

    previousWorkers = doWorkers;
  }

  async function sweep(invokedAt: Date) {
    console.log("@@@@@@@@ sweep worker env", invokedAt);

    if (PERMANENT_WORKER_IP) {
      await Promise.allSettled(PERMANENT_WORKER_IP.map((ip) => prune(ip)));
    }
  }

  queue.on("ready", async () => {
    console.log(
      `manager has been started (concurrency=${JOB_CONCURRENCY} perm=${PERMANENT_WORKER_SIZE})`
    );

    schedule.scheduleJob("10 */1 * * *", rearrange);
    schedule.scheduleJob("10 */6 * * *", sweep);
    await rearrange(new Date());
  });
}
