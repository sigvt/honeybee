import Queue from "bee-queue";
import { Job } from "./types/job";
import redis from "redis";

// feature flags
const QUEUE_NAME = "vespa-collector";
const REDIS_URI = process.env.REDIS_URI || "redis://redis:6379";

export function getQueueInstance(args: any = {}) {
  return new Queue<Job>(QUEUE_NAME, {
    redis: redis.createClient(REDIS_URI),
    ...args,
  });
}
