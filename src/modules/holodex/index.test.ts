import { setupRecorder } from "nock-record";
import { fetchLiveStreams } from ".";

const HOLODEX_API_KEY = process.env.HOLODEX_API_KEY!;

const record = setupRecorder();

it("fetchLiveStreams", async () => {
  const { completeRecording } = await record("fetchLiveStreams");

  const res = await fetchLiveStreams(HOLODEX_API_KEY);

  completeRecording();

  expect(res[0].channel.name).toBeTruthy();
});
