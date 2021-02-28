import { setupRecorder } from "nock-record";
import { fetchLiveStreams } from ".";

const record = setupRecorder();

it("fetchLiveStreams", async () => {
  const { completeRecording, assertScopesFinished } = await record(
    "fetchLiveStreams"
  );

  const res = await fetchLiveStreams();

  completeRecording();

  expect(res[0].channel.name).toBeTruthy();
});
