import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { HOLODEX_API_KEY, CACHE_PATH } from "../../constants";
import { fetchJsonWithRetry } from "../../util";
import { HolodexChannelInfo, HolodexLiveStreamInfo } from "./types";

// there's ~72 constant free-chat rooms

interface FetchLiveStreamsOptions {
  org?: string;
  maxUpcomingHours?: number; // 999999 to catch everything
  apiKey: string;
}

export async function fetchLiveStreams({
  org = "All Vtubers",
  maxUpcomingHours = 12,
  apiKey,
}: FetchLiveStreamsOptions): Promise<HolodexLiveStreamInfo[]> {
  const response = (await fetchJsonWithRetry(
    `https://holodex.net/api/v2/live?org=${encodeURIComponent(
      org
    )}&max_upcoming_hours=${maxUpcomingHours}`,
    {
      method: "GET",
      headers: {
        "user-agent": "holodata/honeybee",
        "x-apikey": HOLODEX_API_KEY!,
      },
      retry: 3,
    }
  )) as HolodexLiveStreamInfo[];

  return response;
}

export const fetchChannel = cached(
  join(CACHE_PATH, "channelInfo.json"),
  async (channelId: string): Promise<HolodexChannelInfo> => {
    const response = (await fetchJsonWithRetry(
      `https://holodex.net/api/v2/channels/${channelId}`,
      {
        method: "GET",
        headers: {
          "user-agent": "holodata/honeybee",
          "x-apikey": HOLODEX_API_KEY!,
        },
        retry: 3,
      }
    )) as HolodexChannelInfo;

    return response;
  }
);

type MaybePromiseReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => Promise<infer R> | infer R
  ? R
  : any;

type CacheRecord = Record<string, { ts: string; v: any }>;

let cachePool = new Map<string, CacheRecord>();

async function getCache(cachePath: string) {
  let res: CacheRecord;
  try {
    const cache = JSON.parse(await readFile(cachePath, "utf-8"));
    res = cache;
    cachePool.set(cachePath, cache);
  } catch (err) {
    res = {};
    cachePool.set(cachePath, {});
  }
  return res;
}

function cacheKey(args: any) {
  return Buffer.from(JSON.stringify(Object.values(args))).toString("base64");
}

function cached<F extends (...args: any) => any>(
  cachePath: string,
  processor: F,
  { lifetimeMs }: { lifetimeMs?: number } = {}
): (...args: Parameters<F>) => Promise<MaybePromiseReturnType<F>> {
  const cacheDir = dirname(cachePath);
  return async (...args) => {
    const cache = await getCache(cachePath);
    const key = cacheKey(args);
    if (
      key in cache &&
      (!lifetimeMs ||
        Date.now() - new Date(cache[key].ts).getTime() < lifetimeMs)
    ) {
      return cache[key].v;
    }
    const res = await Promise.resolve(processor.apply(void 0, args));
    cache[key] = { ts: new Date().toISOString(), v: res };
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cachePath, JSON.stringify(cache));
    return res;
  };
}
