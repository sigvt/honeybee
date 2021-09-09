import { appendFileSync, writeFileSync } from "fs";
import fetch, { FetchError, RequestInfo, RequestInit } from "node-fetch";
import { join } from "path";

interface Record {
  name: string;
  current: number | undefined;
  lastDelta: number;
  history: number[];
  updater: (...args: any) => any | Promise<any>;
}

export function log(message: string, payload?: any): void {
  console.log(message);
}

export function debug(obj: any) {
  console.log(JSON.stringify(obj, null, 2));
}

export function guessFreeChat(title: string) {
  return /(?:[fF]ree\s?[cC]hat|(?:ふりー|フリー)(?:ちゃっと|チャット))/.test(
    title
  );
}

export function saveJSON(filename: string, obj: any) {
  writeFileSync(join(process.cwd(), filename), JSON.stringify(obj, null, 2));
}

export function appendJSON(filename: string, obj: any) {
  appendFileSync(filename, JSON.stringify(obj) + "\n");
}

export function serializeToJsonLines(objArray: any[]): string {
  return objArray.map((obj): string => JSON.stringify(obj)).join("\n") + "\n";
}

export function normalizeVideoId(idOrUrl: string) {
  return idOrUrl.replace(/^https?:\/\/www\.youtube\.com\/watch\?v=/, "");
}

export function assertUnreachable(_: never): never {
  throw new Error("assertUnreachable");
}

export function timeoutThen(duration: number): Promise<number> {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

export class DeltaCollection {
  private records: Record[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
  }

  addRecord(name: string, updater: Record["updater"]): Record {
    const record = {
      name,
      updater,
      current: undefined,
      lastDelta: 0,
      history: Array.from({ length: this.maxHistory }, () => 0),
    };
    this.records.push(record);
    return record;
  }

  async refresh() {
    for (const record of this.records) {
      const data = await Promise.resolve(record.updater());
      const lastDelta = data - (record.current ?? data);
      record.history.push(lastDelta);
      if (record.history.length > this.maxHistory) record.history.shift();
      record.current = data;
      record.lastDelta = lastDelta;
    }
    return this;
  }

  get(name: string): Record | undefined {
    return this.records.find((record) => record.name === name);
  }

  forEach(fn: (record: Record) => any) {
    for (const record of this.records) {
      fn(record);
    }
  }
}

export function groupBy<T, K extends keyof T, S extends Extract<T[K], string>>(
  lst: T[],
  key: K
) {
  return lst.reduce((result, o) => {
    const index = o[key] as S;
    if (!result[index]) result[index] = [];
    result[index].push(o as any);
    return result;
  }, {} as { [k in S]: (T extends { [s in K]: k } ? T : never)[] });
}

export type RequestInitWithRetryOption = RequestInit & {
  retry?: number;
  retryInterval?: number;
};
export interface FetchWithRetryError extends FetchError {
  errors: FetchError[];
}
export async function fetchJsonWithRetry(
  url: RequestInfo,
  init?: RequestInitWithRetryOption
) {
  const errors = [];

  let remaining = init?.retry ?? 0;
  const retryInterval = init?.retryInterval ?? 5000;

  while (true) {
    try {
      const res = await fetch(url, init);
      return await res.json();
    } catch (err) {
      if ((err as any).name === "AbortError") throw err;

      errors.push(err);

      if (remaining > 0) {
        await timeoutThen(retryInterval);
        remaining -= 1;
        continue;
      }

      (err as any).errors = errors;
      throw err;
    }
  }
}
