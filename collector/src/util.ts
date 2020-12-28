import { appendFileSync, writeFileSync } from "fs";
import { join } from "path";

export function log(message: string, payload?: any): void {
  // appendFileSync(
  //   join(process.cwd(), "collector.log"),
  //   Date.now() +
  //     "," +
  //     message.trim() +
  //     "," +
  //     (payload ? JSON.stringify(payload) : "") +
  //     "\n"
  // );
  console.log(message);
}

export function debug(obj: any) {
  console.log(JSON.stringify(obj, null, 2));
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

interface Record {
  name: string;
  current: number | undefined;
  lastDelta: number;
  history: number[];
  updater: (...args: any) => any | Promise<any>;
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

  async fetch() {
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
