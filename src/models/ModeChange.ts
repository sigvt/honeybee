import {
  getModelForClass,
  index,
  modelOptions,
  prop,
} from "@typegoose/typegoose";

@modelOptions({ schemaOptions: { collection: "modechanges" } })
@index({ originVideoId: 1, mode: 1, enabled: 1 }, { unique: true })
export class ModeChange {
  @prop({ required: true, index: true })
  timestamp!: Date;

  @prop({ required: true })
  mode!: string;

  @prop({ required: true })
  enabled!: boolean;

  @prop({ required: true })
  description!: string;

  @prop({ required: true })
  originVideoId!: string;

  @prop({ required: true, index: true })
  originChannelId!: string;
}

export default getModelForClass(ModeChange);
