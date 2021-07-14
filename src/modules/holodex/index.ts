import fetch from "node-fetch";
import { HolodexLiveStreamInfo } from "./types";

export async function fetchLiveStreams(
  apiKey: string
): Promise<HolodexLiveStreamInfo[]> {
  const response = (await fetch(
    "https://holodex.net/api/v2/live?org=All%20Vtubers",
    {
      method: "GET",
      headers: {
        "user-agent": "honeybee",
        "x-apikey": apiKey,
      },
    }
  ).then((res) => res.json())) as HolodexLiveStreamInfo[];

  return response;
}
