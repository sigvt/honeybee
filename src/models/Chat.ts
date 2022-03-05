import {
  getModelForClass,
  modelOptions,
  prop,
  Severity,
} from "@typegoose/typegoose";
import { YTRun, Membership } from "masterchat";

@modelOptions({ options: { allowMixed: Severity.ALLOW } })
export class Chat {
  @prop({ required: true, unique: true })
  public id!: string;

  // TODO: will be normalized
  @prop({ required: true, allowMixed: true })
  public message!: YTRun[] | string;

  @prop()
  public authorName?: string;

  @prop({ required: true, index: true })
  public authorChannelId!: string;

  // TODO: will be normalized
  @prop({ allowMixed: true })
  public membership?: Membership | string;

  @prop({ required: true })
  public isVerified!: Boolean;

  @prop({ required: true })
  public isOwner!: Boolean;

  @prop({ required: true })
  public isModerator!: Boolean;

  @prop({ required: true })
  public originVideoId!: string;

  @prop({ required: true, index: true })
  public originChannelId!: string;

  @prop({ required: true, index: true })
  public timestamp!: Date;

  // TODO: will be removed
  @prop()
  public authorPhoto?: string;

  // TODO: will be removed
  @prop()
  public timestampUsec?: string;
}

export default getModelForClass(Chat);
