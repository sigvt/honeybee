export interface Stats {
  handled: number;
  errors: number;
  isWarmingUp: boolean;
}

export enum ErrorCode {
  MembersOnly = "MEMBERS_ONLY",
  Private = "PRIVATE",
  Unavailable = "UNAVAILABLE",
  Ban = "BAN",
  Unknown = "UNKNOWN",
}

export interface Result {
  error: ErrorCode | null;
  result?: Stats;
}
