import {
  getModelForClass,
  modelOptions,
  prop,
  Severity,
} from "@typegoose/typegoose";
import { YTRun } from "masterchat";

@modelOptions({ options: { allowMixed: Severity.ALLOW } })
export class Milestone {
  @prop({ required: true })
  public id!: string;

  @prop()
  public level?: string;

  @prop()
  public duration?: number;

  @prop()
  public since?: string;

  @prop({ allowMixed: true })
  public message?: YTRun[] | null;

  @prop({ required: true })
  public authorName!: string;

  @prop({ required: true })
  public authorChannelId!: string;

  @prop({ required: true })
  public originVideoId!: string;

  @prop({ required: true })
  public originChannelId!: string;

  @prop({ required: true, index: true })
  public timestamp!: Date;
}

export default getModelForClass(Milestone);
