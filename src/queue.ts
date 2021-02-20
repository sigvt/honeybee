import assert from "assert";
import Queue from "bee-queue";
import redis from "redis";
import { Job } from "./types/job";

// feature flags
const QUEUE_NAME = "vespa-collector";
const REDIS_URI = process.env.REDIS_URI;

export function getQueueInstance(args: any = {}) {
  assert(REDIS_URI);

  return new Queue<Job>(QUEUE_NAME, {
    redis: redis.createClient(REDIS_URI),
    ...args,
  });
}
