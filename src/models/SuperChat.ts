import {
  getModelForClass,
  modelOptions,
  prop,
  Severity,
} from "@typegoose/typegoose";

@modelOptions({
  options: { allowMixed: Severity.ALLOW },
  schemaOptions: { collection: "superchats" },
})
export class SuperChat {
  @prop({ required: true, unique: true })
  public id!: string;

  @prop({ required: true })
  public message!: string | null;

  @prop()
  public authorName?: string;

  @prop({ required: true, index: true })
  public authorChannelId!: string;

  @prop({ required: true })
  public purchaseAmount!: number;

  @prop({ required: true, index: true })
  public currency!: string;

  @prop({ required: true, index: true })
  public significance!: number;

  @prop({ required: true })
  public color!: string;

  @prop({ required: true, index: true })
  public originVideoId!: string;

  @prop({ required: true, index: true })
  public originChannelId!: string;

  @prop({ required: true, index: true })
  public timestamp!: Date;
}

export default getModelForClass(SuperChat);
