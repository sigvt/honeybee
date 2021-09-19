import { setupRecorder } from "nock-record";
import { fetchChannel, fetchLiveStreams } from ".";

const record = setupRecorder();

it("fetchLiveStreams", async () => {
  const { completeRecording } = await record("fetchLiveStreams");

  const res = await fetchLiveStreams({ apiKey: "" });

  completeRecording();

  expect(res[0].channel.name).toBeTruthy();
});

it("fetchChannel", async () => {
  const { completeRecording } = await record("fetchChannel");

  const res = await fetchChannel("UCHsx4Hqa-1ORjQTh9TYDhww");
  const res2 = await fetchChannel("UChgTyjG-pdNvxxhdsXfHQ5Q");

  completeRecording();

  expect(res.name).toBe("Takanashi Kiara Ch. hololive-EN");
  expect(res2.name).toBe("Pavolia Reine Ch. hololive-ID");
}, 10000);
