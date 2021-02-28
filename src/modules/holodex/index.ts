import fetch from "node-fetch";
import { HolodexLiveStreamInfo } from "./types";

export async function fetchLiveStreams(): Promise<HolodexLiveStreamInfo[]> {
  const response = (await fetch(
    "https://holodex.net/api/v2/live?org=All%20Vtubers",
    {
      method: "GET",
      headers: {
        "user-agent": "honeybee",
      },
    }
  ).then((res) => res.json())) as HolodexLiveStreamInfo[];

  return response;
}
