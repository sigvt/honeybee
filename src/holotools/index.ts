import fetch from "node-fetch";
import {
  HolotoolsLiveStreamsResponse,
  HolotoolsLiveStreamInfo,
} from "../types/holotools";

export interface FetchLiveStreamsOptions {
  maxUpcomingHours?: number;
  hideChannelDescription?: boolean;
}
export async function fetchLiveStreams({
  maxUpcomingHours = 2190,
  hideChannelDescription = false,
}: FetchLiveStreamsOptions = {}): Promise<HolotoolsLiveStreamInfo[]> {
  // Request (GET https://api.holotools.app/v1/live?max_upcoming_hours=2190&hide_channel_desc=1)
  const response = (await fetch(
    `https://api.holotools.app/v1/live?max_upcoming_hours=${maxUpcomingHours}&hide_channel_desc=${Number(
      hideChannelDescription
    )}`,
    {
      method: "GET",
      headers: {
        "user-agent": "Vespa",
      },
    }
  ).then((res) => res.json())) as HolotoolsLiveStreamsResponse;

  return [...response.live, ...response.upcoming];
}
