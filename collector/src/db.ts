import { mongoose } from "@typegoose/typegoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://db:27017/vespa";

export async function initMongo() {
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  });
  return () => mongoose.disconnect();
}
