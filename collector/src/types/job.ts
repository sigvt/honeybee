import { HolodexLiveStreamInfo } from "./holodex";

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
