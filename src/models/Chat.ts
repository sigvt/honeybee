import {
  getModelForClass,
  modelOptions,
  prop,
  Severity,
} from "@typegoose/typegoose";
import { Membership, SuperChat } from "masterchat/lib/chat";
import { YTRun } from "masterchat/lib/types/chat";

@modelOptions({ options: { allowMixed: Severity.ALLOW } })
class Chat {
  @prop({ required: true, unique: true })
  public id!: string;

  @prop({ required: true, allowMixed: true })
  public message!: YTRun[];

  // TODO: migrate to message
  // @prop({ allowMixed: true })
  // public rawMessage?: YTRun[];

  // TODO: will be moved to SuperChat
  // @prop({ allowMixed: true })
  // public purchase?: SuperChat;

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
  public timestamp!: Date;

  // TODO: will be removed
  // @prop()
  // public timestampUsec?: string;
}

export default getModelForClass(Chat);
