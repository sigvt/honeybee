import schedule from "node-schedule";
import { fetchLiveStreams } from "./modules/holodex";
import { HolodexLiveStreamInfo } from "./modules/holodex/types";
import { getQueueInstance } from "./modules/queue";
import { guessFreeChat, timeoutThen } from "./util";
import { ErrorCode, Result, Stats } from "./worker";

const SHUTDOWN_TIMEOUT = 30 * 1000;
const IGNORE_FREE_CHAT = false;

const JOB_CONCURRENCY = Number(process.env.JOB_CONCURRENCY || 1);

function schedulerLog(...obj: any) {
  console.log(`scheduler:`, ...obj);
}

export async function runScheduler() {
  const queue = getQueueInstance({ isWorker: false });
  const handledVideoIdCache: Set<string> = new Set();

  process.on("SIGTERM", async () => {
    console.log("!!!!!!!!!!!!!!!!!!Got SIGTERM");
    // Queue#close is idempotent - no need to guard against duplicate calls.
    try {
      await queue.close(SHUTDOWN_TIMEOUT);
    } catch (err) {
      schedulerLog("bee-queue failed to shut down gracefully", err);
    }
    process.exit(1);
  });

  async function handleStream(stream: HolodexLiveStreamInfo) {
    const videoId = stream.id;
    const title = stream.title;
    const scheduledStartTime = stream.start_scheduled;

    if (handledVideoIdCache.has(videoId)) return;

    // filter out freechat
    if (IGNORE_FREE_CHAT && guessFreeChat(title)) return;

    const startUntil = scheduledStartTime
      ? new Date(scheduledStartTime).getTime() - Date.now()
      : 0;
    const startsInMin = Math.floor(startUntil / 1000 / 60);
    if (startsInMin < -10080 && !guessFreeChat(title)) {
      schedulerLog(
        `${videoId} (${title}) will be ignored. it was started in ${startsInMin} min and not a free chat, which must be strayed stream.`
      );
      return;
    }

    // if failed to receive chat:
    // prechat -> retry after max(1m, 1/3 of startUntil) for 3 times
    // livechat -> retry after 5m for 3 times
    // but not longer than 30 minutes
    const estimatedDelay = Math.min(
      Math.max(Math.floor(startUntil / 3), 5 * 60 * 1000),
      30 * 60 * 1000
    );
    await queue
      .createJob({ videoId, stream })
      .setId(videoId)
      .retries(3)
      .backoff("fixed", estimatedDelay)
      .save();

    schedulerLog(
      `scheduled ${videoId} (${title}), starts in ${startsInMin} minutes`
    );

    handledVideoIdCache.add(videoId);

    await timeoutThen(5 * 1000);
  }

  async function rearrange(invokedAt: Date) {
    schedulerLog("@@@@@@@@ updating index", invokedAt);

    await queue.checkStalledJobs();

    const alreadyActiveJobs = (
      await queue.getJobs("active", { start: 0, end: 300 })
    ).map((job) => job.data.videoId);

    const liveAndUpcomingStreams = (await fetchLiveStreams()).filter(
      (stream) => !alreadyActiveJobs.includes(stream.id)
    );

    if (liveAndUpcomingStreams.length === 0) {
      schedulerLog("liveAndUpcomingStreams.length === 0");
      return;
    }

    for (const stream of liveAndUpcomingStreams) {
      await handleStream(stream);
    }

    // show metrics
    const health = await queue.checkHealth();
    const activeJobs = await queue.getJobs("active", { start: 0, end: 300 });
    let nbWarmingUp = 0;
    let nbTotal = 0;
    for (const job of activeJobs) {
      nbTotal += 1;
      const progress: Stats = job.progress;
      if (progress.isWarmingUp) nbWarmingUp += 1;
    }
    console.log(
      `# METRICS
Total=${nbTotal} (${health.active})
Active=${nbTotal - nbWarmingUp}
WarmingUp=${nbWarmingUp}
Waiting=${health.waiting}
Delayed=${health.delayed}`
    );

    // TODO: auto scale worker nodes
    const totalJobs = health.active + health.delayed + health.waiting;
    const totalWorkers = Math.ceil(totalJobs / JOB_CONCURRENCY);
    // terraform apply -var total_workers=${totalWorkers}
    console.log(`SUGGESTED WORKER COUNT: ${totalWorkers}`);
  }

  // redis related error
  queue.on("error", (err) => {
    schedulerLog(`${err.message}`);
    process.exit(1);
  });

  queue.on("stalled", (jobId) => {
    schedulerLog("[stalled]:", "detection report", jobId);
  });

  queue.on("job succeeded", async (jobId, result: Result) => {
    const job = await queue.getJob(jobId);

    schedulerLog("[job succeeded]:", jobId, result);

    switch (result.error) {
      case ErrorCode.MembershipOnly: {
        // do not remove id from cache so that the scheduler can ignore the stream.
        break;
      }
      default: {
        // live stream is still ongoing but somehow got response with empty continuation hence mistaken as being finished -> will be added in next invocation. If the stream was actually ended that's ok bc the stream index won't have that stream anymore, or else it will be added to worker again.
        // live stream was over and the result is finalized -> the index won't have that videoId anymore so it's safe to remove them from the cache
        handledVideoIdCache.delete(job.data.videoId);
        schedulerLog(
          "[job succeeded]:",
          `removed ${jobId} from handled id cache`
        );
      }
    }

    await job.remove();
    schedulerLog("[job succeeded]:", `removed ${jobId} from job queue`);
  });

  queue.on("job retrying", async (jobId, err) => {
    const job = await queue.getJob(jobId);
    const retries = job.options.retries;
    const retryDelay = job.options.backoff.delay;

    if (err.message.includes("innertubeApiKey")) {
      handledVideoIdCache.delete(job.data.videoId);
      await job.remove();
      schedulerLog(
        "[job retrying]:",
        `looks like ip ban. cancelled retry and immediately removed ${jobId} from cache and job queue`
      );
    } else {
      schedulerLog(
        "[job retrying]:",
        `will retry ${jobId} in ${Math.ceil(
          retryDelay / 1000 / 60
        )} minutes (${retries}). cause: ${err.message}`
      );
    }
  });

  queue.on("job failed", async (jobId, err) => {
    schedulerLog("[job failed]:", jobId, err.message);

    const job = await queue.getJob(jobId);

    // chances that chat is disabled until live goes online
    handledVideoIdCache.delete(job.data.videoId);
    await queue.removeJob(jobId);

    schedulerLog(
      "[job failed]:",
      `removed ${job.data.videoId} from cache and job queue for later retry`
    );
  });

  queue.on("ready", async () => {
    await timeoutThen(1000 * 10);

    handledVideoIdCache.clear();

    console.log(`QUEUE READY (concurrency: ${JOB_CONCURRENCY})`);

    const scheduler = schedule.scheduleJob("*/10 * * * *", rearrange);

    console.log("Honeybee Scheduler has been started:", scheduler.name);

    await rearrange(new Date());
  });
}
