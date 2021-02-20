import { getModelForClass, prop } from "@typegoose/typegoose";

class DeleteAction {
  @prop({ required: true })
  targetId!: String;

  @prop({ required: true })
  retracted!: Boolean;

  @prop({ required: true })
  originVideoId!: String;

  @prop({ required: true })
  originChannelId!: String;

  @prop()
  timestampUsec?: String;
}

export default getModelForClass(DeleteAction);
