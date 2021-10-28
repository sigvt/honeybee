import { getModelForClass, prop } from "@typegoose/typegoose";

// @index({ targetId: 1, originVideoId: 1 }, { unique: true })
export class Membership {
  @prop({ required: true, unique: true })
  public id!: string;

  @prop()
  public level?: string;

  @prop()
  public since?: string;

  @prop({ required: true })
  public authorName!: string;

  @prop({ required: true, index: true })
  public authorChannelId!: string;

  @prop({ required: true })
  public originVideoId!: string;

  @prop({ required: true, index: true })
  public originChannelId!: string;

  @prop({ required: true, index: true })
  public timestamp!: Date;
}

export default getModelForClass(Membership);
