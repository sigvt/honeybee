import { initMongo } from "../modules/db";
import SuperChat from "../models/SuperChat";

export async function inspect(argv: any) {
  console.log("connecting");
  const disconnect = await initMongo();

  const sc = await SuperChat.find({}, { _id: 0, currency: 1 }).limit(100000);
  const c = Array.from(new Set(sc.map((s: any) => s.currency))).filter(
    (s: any) => !/[A-Z]{3}/.test(s)
  );
  console.log(c);

  await disconnect();
}
