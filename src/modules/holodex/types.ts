export interface HolodexLiveStreamInfo {
  id: string;
  title: string;
  type: WelcomeType;
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

export enum WelcomeType {
  Stream = "stream",
}
