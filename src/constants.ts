export const SHUTDOWN_TIMEOUT = 30 * 1000;
export const IGNORE_FREE_CHAT = !!(process.env.IGNORE_FREE_CHAT ?? false);
export const JOB_CONCURRENCY = Number(process.env.JOB_CONCURRENCY ?? 1);
export const CACHE_PATH =
  process.env.CACHE_PATH ?? process.env.HOLODEX_CACHE_PATH ?? "./cache";
export const HOLODEX_API_KEY = process.env.HOLODEX_API_KEY;
export const HOLODEX_MAX_UPCOMING_HOURS = Number(
  process.env.HOLODEX_MAX_UPCOMING_HOURS ?? 12
);
