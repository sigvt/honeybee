import { getModelForClass, modelOptions, prop } from "@typegoose/typegoose";

// @index({ targetId: 1, originVideoId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: "deleteactions" } })
export class Deletion {
  @prop({ required: true, index: true })
  targetId!: string;

  @prop({ required: true })
  retracted!: Boolean;

  @prop({ required: true, index: true })
  originVideoId!: string;

  @prop({ required: true, index: true })
  originChannelId!: string;

  @prop({ required: true, index: true })
  timestamp!: Date;
}

export default getModelForClass(Deletion);
