import { getModelForClass, prop } from "@typegoose/typegoose";

// @index({ targetId: 1, originVideoId: 1 }, { unique: true })
class DeleteAction {
  @prop({ required: true })
  targetId!: string;

  @prop({ required: true })
  retracted!: Boolean;

  @prop({ required: true })
  originVideoId!: string;

  @prop({ required: true })
  originChannelId!: string;

  @prop({ required: true, index: true })
  timestamp!: Date;
}

export default getModelForClass(DeleteAction);
