import {
  getModelForClass,
  modelOptions,
  prop,
  Severity,
} from "@typegoose/typegoose";
import { Run } from "../modules/youtube/types/chat";

@modelOptions({ options: { allowMixed: Severity.ALLOW } })
class Chat {
  @prop({ required: true, unique: true })
  public id!: String;

  @prop({ allowMixed: true })
  public rawMessage?: Run[];

  @prop()
  public authorName?: String;

  @prop({ required: true })
  public authorChannelId!: String;

  @prop({ required: true })
  public authorPhoto!: String;

  @prop({ required: true })
  public isVerified!: Boolean;

  @prop({ required: true })
  public isOwner!: Boolean;

  @prop({ required: true })
  public isModerator!: Boolean;

  @prop({ required: true })
  public originVideoId!: String;

  @prop({ required: true })
  public originChannelId!: String;

  @prop({ required: true })
  public timestampUsec!: String;
}

export default getModelForClass(Chat);
