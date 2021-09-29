import { mongoose } from "@typegoose/typegoose";
import assert from "assert";

const MONGO_URI = process.env.MONGO_URI;

export async function initMongo() {
  assert(MONGO_URI);

  // await mongoose.connect(MONGO_URI, {
  //   useNewUrlParser: true,
  //   useUnifiedTopology: true,
  //   useCreateIndex: true,
  // });
  await mongoose.connect(MONGO_URI);

  return () => mongoose.disconnect();
}
