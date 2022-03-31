import {
  getModelForClass,
  modelOptions,
  prop,
  Severity,
} from "@typegoose/typegoose";
import { YTRun } from "masterchat";

@modelOptions({
  options: { allowMixed: Severity.ALLOW },
  schemaOptions: { collection: "milestones" },
})
export class Milestone {
  @prop({ required: true, unique: true })
  public id!: string;

  @prop({ required: true })
  public message!: string | null;

  @prop()
  public authorName?: string;

  @prop({ required: true, index: true })
  public authorChannelId!: string;

  @prop()
  public level?: string;

  @prop()
  public duration?: number;

  @prop()
  public since?: string;

  @prop({ required: true, index: true })
  public originVideoId!: string;

  @prop({ required: true, index: true })
  public originChannelId!: string;

  @prop({ required: true, index: true })
  public timestamp!: Date;
}

export default getModelForClass(Milestone);
