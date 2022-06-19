import {
  getModelForClass,
  index,
  modelOptions,
  prop,
} from "@typegoose/typegoose";

// @index({ targetId: 1, originVideoId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: "removechatactions" } })
export class RemoveChatAction {
  @prop({ required: true, index: true })
  targetId!: string;

  @prop({ required: true, index: true })
  originVideoId!: string;

  @prop({ required: true, index: true })
  originChannelId!: string;

  @prop({ required: true, index: true })
  timestamp!: Date;
}

export default getModelForClass(RemoveChatAction);
