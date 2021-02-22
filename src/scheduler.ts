import schedule from "node-schedule";
import { fetchLiveStreams } from "./holodex";
import { getQueueInstance } from "./queue";
import { HolodexLiveStreamInfo } from "./types/holodex";
import { ErrorCode, Result } from "./types/job";

const IGNORE_FREE_CHAT = false;

const queue = getQueueInstance({ isWorker: false });
const handledVideoIdCache: Set<string> = new Set();

queue.on("ready", () => {
  console.log("SCHEDULER READY");
});

queue.on("error", (err) => {
  console.log(`SCHEDULER RECEIVED ERROR: ${err.message}`);
});

queue.on("stalled", (jobId) => {
  console.log(
    `SCHEDULER RECEIVED STALLED [${jobId}]: stalled and will be reprocessed`
  );
});

queue.on("job succeeded", async (jobId, result: Result) => {
  console.log("JOB COMPLETED", jobId, result);

  const job = await queue.getJob(jobId);

  switch (result.error) {
    case ErrorCode.MembershipOnly: {
      // do not remove id from cache so that the scheduler can ignore the stream.
      break;
    }
    default: {
      // live stream is still ongoing but somehow got response with empty continuation hence mistaken as being finished -> will be added in next invocation. If it was actually ended that's ok bc the index won't have that stream anymore, else it will be added to worker again.
      // live stream was over and the result is finalized -> the index won't have that videoId anymore so it's safe to remove them from the cache
      handledVideoIdCache.delete(job.data.videoId);
    }
  }
  await queue.removeJob(jobId);
});

queue.on("job retrying", async (jobId, err) => {
  const job = await queue.getJob(jobId);
  const retries = job.options.retries;
  const retryDelay = job.options.backoff.delay;
  console.log(
    `JOB RETRYING: ${jobId} failed with error ${
      err.message
    } but is being retried in ${Math.floor(
      retryDelay / 1000 / 60
    )} minutes (${retries})`
  );
});

queue.on("job failed", async (jobId, err) => {
  console.log("JOB FAILED", jobId, err.message);

  const job = await queue.getJob(jobId);

  // chances that chat is disabled until live goes online
  handledVideoIdCache.delete(job.data.videoId);
  await queue.removeJob(jobId);

  console.log(
    "REMOVED",
    `${job.data.videoId} from cached pool for later retry`
  );
});

function guessFreeChat(title: string) {
  return (
    IGNORE_FREE_CHAT &&
    /(?:[fF]ree\s?[cC]hat|(?:ふりー|フリー)(?:ちゃっと|チャット))/.test(title)
  );
}

async function handleStream(stream: HolodexLiveStreamInfo) {
  const videoId = stream.id;

  if (handledVideoIdCache.has(videoId)) return;

  // filter out freechat
  if (guessFreeChat(stream.title)) return;

  const startUntil = stream.start_scheduled
    ? new Date(stream.start_scheduled).getTime() - Date.now()
    : 0;

  // if failed to receive chat:
  // prechat -> retry after max(1m, 1/3 of startUntil) for 3 times
  // livechat -> retry after 5m for 3 times
  const job = await queue
    .createJob({ videoId, stream })
    .setId(videoId)
    .retries(3)
    .backoff("fixed", Math.max(Math.floor(startUntil / 3), 5 * 60 * 1000))
    .save();

  console.log(
    `Scheduled job for ${videoId} (${stream.title}) with worker ${
      job.id
    } (starts in ${Math.floor(startUntil / 1000 / 60)} minutes)`
  );

  handledVideoIdCache.add(videoId);
}

// watch channel and add newly created live stream to redis queue
async function scrapeLiveStreams(invokedAt: Date) {
  console.log("FETCH INDEX", invokedAt);

  await queue.checkStalledJobs();

  const liveAndUpcomingStreams = await fetchLiveStreams();

  if (liveAndUpcomingStreams.length === 0) return;

  for (const stream of liveAndUpcomingStreams) {
    await handleStream(stream);
  }

  console.log("HEALTH", await queue.checkHealth());

  for (const [id, job] of queue.jobs) {
    console.log(
      `${job.status}(${id})`,
      job.progress,
      job.data.stream.channel.name
    );
  }
}

const TIMEOUT = 30 * 1000;

async function main() {
  const scheduler = schedule.scheduleJob("*/10 * * * *", scrapeLiveStreams);

  console.log("Vespa Scheduler has been started:", scheduler.name);

  await scrapeLiveStreams(new Date());
}

main().catch(async (err) => {
  console.log(err);

  // Queue#close is idempotent - no need to guard against duplicate calls.
  try {
    await queue.close(TIMEOUT);
  } catch (err) {
    console.error("bee-queue failed to shut down gracefully", err);
  }

  process.exit(1);
});

process.on("uncaughtException", async () => {
  // Queue#close is idempotent - no need to guard against duplicate calls.
  try {
    await queue.close(TIMEOUT);
  } catch (err) {
    console.error("bee-queue failed to shut down gracefully", err);
  }

  process.exit(1);
});
