import {
  getModelForClass,
  modelOptions,
  prop,
  Severity,
} from "@typegoose/typegoose";
import { Membership, Purchase, Run } from "../modules/youtube/types/chat";

@modelOptions({ options: { allowMixed: Severity.ALLOW } })
class Chat {
  @prop({ required: true, unique: true })
  public id!: string;

  @prop({ allowMixed: true })
  public rawMessage?: Run[];

  @prop({ allowMixed: true })
  public purchase?: Purchase;

  @prop({ allowMixed: true })
  public membership?: Membership;

  @prop()
  public authorName?: string;

  @prop({ required: true })
  public authorChannelId!: string;

  @prop({ required: true })
  public authorPhoto!: string;

  @prop({ required: true })
  public isVerified!: Boolean;

  @prop({ required: true })
  public isOwner!: Boolean;

  @prop({ required: true })
  public isModerator!: Boolean;

  @prop({ required: true })
  public originVideoId!: string;

  @prop({ required: true })
  public originChannelId!: string;

  @prop({ required: true, index: true })
  public timestamp?: Date;

  @prop()
  public timestampUsec?: string;
}

export default getModelForClass(Chat);
