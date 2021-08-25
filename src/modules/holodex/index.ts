import { fetchJsonWithRetry } from "../../util";
import { HolodexLiveStreamInfo } from "./types";

// there's ~72 constant free-chat rooms

interface FetchLiveStreamsOptions {
  org?: string;
  maxUpcomingHours?: number; // 999999 to catch everything
}

export async function fetchLiveStreams(
  apiKey: string,
  { org = "All Vtubers", maxUpcomingHours = 12 }: FetchLiveStreamsOptions = {}
): Promise<HolodexLiveStreamInfo[]> {
  const response = (await fetchJsonWithRetry(
    `https://holodex.net/api/v2/live?org=${encodeURIComponent(
      org
    )}&max_upcoming_hours=${maxUpcomingHours}`,
    {
      method: "GET",
      headers: {
        "user-agent": "holodata/honeybee",
        "x-apikey": apiKey,
      },
      retry: 3,
    }
  )) as HolodexLiveStreamInfo[];

  return response;
}
