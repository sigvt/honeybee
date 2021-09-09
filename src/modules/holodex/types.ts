export interface HolodexLiveStreamInfo {
  id: string;
  title: string;
  type: VideoType;
  topic_id?: string;
  published_at: Date;
  available_at: Date;
  status: Status;
  start_scheduled: Date | undefined;
  channel: Channel;
  start_actual?: Date;
  live_viewers?: number;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  photo: string;
  english_name?: string;
}

export enum ChannelType {
  Vtuber = "vtuber",
}

export enum Status {
  Live = "live",
  Upcoming = "upcoming",
}

export enum VideoType {
  Stream = "stream",
}

export interface HolodexChannelInfo {
  banner: string;
  clip_count: number;
  comments_crawled_at: string;
  crawled_at: string;
  created_at: string;
  description: string;
  english_name: string;
  id: string;
  inactive: boolean;
  lang: null;
  name: string;
  org: string;
  photo: string;
  published_at: string;
  suborg: string;
  subscriber_count: string;
  thumbnail: string;
  top_topics: string[];
  twitter: string;
  type: string;
  updated_at: string;
  video_count: string;
  view_count: string;
  yt_uploads_id: string;
}
