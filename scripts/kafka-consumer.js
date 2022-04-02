const uuidv4 = require("uuid").v4;
const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "chat-consumer",
  brokers: ["hb.holodata.org:9093"],
});

const consumer = kafka.consumer({ groupId: uuidv4() });

async function convertMessage(msg) {
  const payload = JSON.parse(msg.value.toString());
  return payload;
}

async function exportMessages(msgs) {
  msgs.map((msg) => console.log(msg.ts, msg.aut, msg.msg));
}

async function connect(topicToSubscribe) {
  await consumer.connect();
  await consumer.subscribe({ topic: topicToSubscribe });

  return consumer.run({
    eachBatch: async ({ batch }) => {
      const messages = await Promise.all(batch.messages.map(convertMessage));
      await exportMessages(messages);
    },
  });
}

function disconnect() {
  consumer.disconnect();
}

async function main() {
  const conn = await connect("chats");
}

main();
