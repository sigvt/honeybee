export interface HolotoolsLiveStreamsResponse {
  live: HolotoolsLiveStreamInfo[];
  upcoming: HolotoolsLiveStreamInfo[];
  ended: HolotoolsLiveStreamInfo[];
  cached: boolean;
}

export interface HolotoolsLiveStreamInfo {
  id: number;
  yt_video_key: string;
  bb_video_id: null;
  title: string;
  thumbnail: null;
  status: LiveStatus;
  live_schedule: Date;
  live_start: Date | null;
  live_end: Date | null;
  live_viewers: number | null;
  channel: Channel;
}

export interface Channel {
  id: number;
  yt_channel_id: string;
  bb_space_id: null;
  name: string;
  photo: string;
  published_at: Date;
  twitter_link: string;
  view_count: number;
  subscriber_count: number;
  video_count: number;
}

export enum LiveStatus {
  Live = "live",
  Past = "past",
  Upcoming = "upcoming",
}
