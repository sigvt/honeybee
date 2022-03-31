import { getModelForClass, modelOptions, prop } from "@typegoose/typegoose";

// @index({ channelId: 1, originVideoId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: "banactions" } })
export class BanAction {
  @prop({ required: true, index: true })
  channelId!: string;

  @prop({ required: true, index: true })
  originVideoId!: string;

  @prop({ required: true, index: true })
  originChannelId!: string;

  @prop({ required: true, index: true })
  timestamp!: Date;
}

export default getModelForClass(BanAction);
