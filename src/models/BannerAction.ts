import {
  getModelForClass,
  modelOptions,
  prop,
  Severity,
} from "@typegoose/typegoose";

@modelOptions({
  options: { allowMixed: Severity.ALLOW },
  schemaOptions: { collection: "banneractions" },
})
export class BannerAction {
  @prop({ required: true, index: true })
  public timestamp!: Date;

  @prop({ required: true, unique: true })
  public actionId!: string;

  @prop({ required: true })
  public title!: string;

  @prop({ required: true })
  public rawTitle!: any;

  @prop()
  public message?: string;

  @prop()
  public authorName?: string;

  @prop({ required: true, index: true })
  public authorChannelId!: string;

  @prop()
  public membership?: string;

  @prop({ required: true, index: true })
  public isVerified!: Boolean;

  @prop({ required: true, index: true })
  public isOwner!: Boolean;

  @prop({ required: true, index: true })
  public isModerator!: Boolean;

  @prop({ required: true, index: true })
  public originVideoId!: string;

  @prop({ required: true, index: true })
  public originChannelId!: string;
}

export default getModelForClass(BannerAction);
