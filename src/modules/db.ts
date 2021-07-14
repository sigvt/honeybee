import { mongoose } from "@typegoose/typegoose";
import assert from "assert";

const MONGO_URI = process.env.MONGO_URI!;
assert(MONGO_URI);

export async function initMongo() {
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  });

  return () => mongoose.disconnect();
}
