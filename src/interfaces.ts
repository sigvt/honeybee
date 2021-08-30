export interface Stats {
  handled: number;
  errors: number;
  isWarmingUp: boolean;
}

export enum ErrorCode {
  MembersOnly = "MEMBERS_ONLY",
  UnknownError = "UNKNOWN",
  Ban = "BAN",
}

export interface Result {
  error: ErrorCode | null;
  result?: Stats;
}
