import { getModelForClass, prop } from "@typegoose/typegoose";

// @index({ channelId: 1, originVideoId: 1 }, { unique: true })
class BanAction {
  @prop({ required: true })
  channelId!: string;

  @prop({ required: true })
  originVideoId!: string;

  @prop({ required: true })
  originChannelId!: string;

  @prop({ required: true, index: true })
  timestamp!: Date;
}

export default getModelForClass(BanAction);
