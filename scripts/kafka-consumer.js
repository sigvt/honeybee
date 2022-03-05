const uuidv4 = require("uuid").v4;
const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "chat-consumer",
  brokers: ["127.0.0.1:9093"],
});

const consumer = kafka.consumer({ groupId: uuidv4() });

async function convertMessage(msg) {
  const formattedValue = JSON.parse(msg.value.toString());
  const payload = JSON.parse(formattedValue.payload);
  const { id, authorName, message } = payload;
  return [id, authorName, message];
}

async function exportMessages(msgs) {
  console.log(msgs);
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
  const conn = await connect("honeybee.chats");
}

main();
