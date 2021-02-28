import assert from "assert";
import Queue from "bee-queue";
import redis from "redis";
import { HolodexLiveStreamInfo } from "./holodex/types";

export enum ErrorCode {
  MembershipOnly,
  UnknownError,
}

export interface Result {
  error: ErrorCode | null;
  result?: Stats;
}

export interface Job {
  videoId: string;
  stream: HolodexLiveStreamInfo;
}

export interface Stats {
  chat: number;
  retracted: number;
  deleted: number;
  banned: number;
}

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
