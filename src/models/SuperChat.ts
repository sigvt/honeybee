import {
  getModelForClass,
  modelOptions,
  prop,
  Severity,
} from "@typegoose/typegoose";
import { YTRun } from "masterchat";

@modelOptions({ options: { allowMixed: Severity.ALLOW } })
class SuperChat {
  @prop({ required: true, unique: true })
  public id!: string;

  @prop({ allowMixed: true })
  public message!: YTRun[] | null;

  @prop({ required: true })
  public purchaseAmount!: number;

  @prop({ required: true })
  public currency!: string;

  @prop({ required: true })
  public significance!: number;

  @prop({ required: true })
  public color!: string;

  @prop()
  public authorName?: string;

  @prop({ required: true })
  public authorChannelId!: string;

  @prop({ required: true })
  public authorPhoto!: string;

  @prop({ required: true })
  public originVideoId!: string;

  @prop({ required: true })
  public originChannelId!: string;

  @prop({ required: true, index: true })
  public timestamp!: Date;
}

export default getModelForClass(SuperChat);
