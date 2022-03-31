import { getModelForClass, modelOptions, prop } from "@typegoose/typegoose";

@modelOptions({ schemaOptions: { collection: "chats" } })
export class Chat {
  @prop({ required: true, unique: true })
  public id!: string;

  @prop({ required: true })
  public message!: string;

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

  @prop({ required: true, index: true })
  public timestamp!: Date;
}

export default getModelForClass(Chat);
