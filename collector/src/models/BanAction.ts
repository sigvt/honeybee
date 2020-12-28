import { getModelForClass, prop } from "@typegoose/typegoose";

class BanAction {
  @prop({ required: true })
  channelId!: String;

  @prop({ required: true })
  originVideoId!: String;

  @prop({ required: true })
  originChannelId!: String;

  @prop()
  timestampUsec?: String;
}

export default getModelForClass(BanAction);
