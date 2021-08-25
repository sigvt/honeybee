import assert from "assert";
import Queue from "bee-queue";
import redis from "redis";
import { HolodexLiveStreamInfo } from "./holodex/types";

export interface Job {
  videoId: string;
  stream: HolodexLiveStreamInfo;
}

// feature flags
const QUEUE_NAME = "honeybee";
const REDIS_URI = process.env.REDIS_URI;

export function getQueueInstance(args: any = {}) {
  assert(REDIS_URI);

  return new Queue<Job>(QUEUE_NAME, {
    redis: redis.createClient(REDIS_URI),
    stallInterval: 15 * 1000,
    ...args,
  });
}
