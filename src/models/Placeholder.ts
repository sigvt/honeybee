import { getModelForClass, modelOptions, prop } from "@typegoose/typegoose";

// @modelOptions({ options: { allowMixed: Severity.ALLOW } })
@modelOptions({ schemaOptions: { collection: "placeholders" } })
export class Placeholder {
  @prop({ required: true, index: true })
  timestamp!: Date;

  @prop({ required: true, unique: true })
  id!: string;

  @prop({ required: true, index: true })
  originVideoId!: string;

  @prop({ required: true, index: true })
  originChannelId!: string;
}

export default getModelForClass(Placeholder);
