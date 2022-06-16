#!/usr/bin/env node

const mongoose = require("mongoose");
const chalk = require("chalk");
const Chat = require("../lib/models/Chat.js").default;
const SuperChat = require("../lib/models/SuperChat.js").default;
const Deletion = require("../lib/models/Deletion.js").default;
const BanAction = require("../lib/models/BanAction.js").default;
const toVideoId = require("masterchat").toVideoId;

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost/honeybee";

const HOLOLIVE_CHANNEL_IDS = [
  "UC0TXe_LYZ4scaW2XMyi5_kw",
  "UC1CfXB_kRs3C-zaeTG3oGyg",
  "UC1DCedRgGHBdm81E1llLhOQ",
  "UC1opHUrw8rvnsadT-iGp7Cg",
  "UC1suqwovbL1kzsoaZgFZLKg",
  "UC1uv2Oq6kNxgATlCiez59hw",
  "UC3n5uGu18FoCy23ggWWp8tA",
  "UC5CwaMl1eIgY8h02uZw7u8A",
  "UC6eWCld0KwmyHFbAqK3V-Rw",
  "UC6t3-_N8A6ME1JShZHHqOMw",
  "UC727SQYUvx5pDDGQpTICNWg",
  "UC7fk0CB07ly8oSl0aqKkqFg",
  "UC8rcEBzJSleTkf_-agPM20g",
  "UC9mf_ZVpouoILRY9NUIaK-w",
  "UCa9Y57gfeY0Zro_noHRVrnw",
  "UCANDOlYTJT7N5jlRC3zfzVA",
  "UCAoy6rzhSf4ydcYjJw3WoVg",
  "UCAWSyEs_Io8MtpY3m-zqILA",
  "UCc88OV45ICgHbn3ZqLLb52w",
  "UCCzUftO8KOVkV4wQG1vkUvg",
  "UCD8HOxPs4Xvsm8H0ZxXGiBw",
  "UCdfMHxjcCc2HSd9qFvfJgjg",
  "UCdn5BQ06XqgXoAxIhbqw5Rg",
  "UCDqI2jOz0weumE8s7paEk6g",
  "UCdyqAaZDKHXg4Ahi7VENThQ",
  "UCENwRMx5Yh42zWpzURebzTw",
  "UCEzsociuFqVwgZuMaZqaCsg",
  "UCFKOVgVbGmX65RxO3EtH3iw",
  "UCfrWoRGlawPQDQxxeIDRP0Q",
  "UCFTLzh12_nrtzqBPsTCqenA",
  "UCGKgJ4MtJ1coi6tWJUfnsQA",
  "UCgmPnx-EEeOrZSg5Tiw7ZRQ",
  "UCGNI4MENvnsymYjKiZwv9eg",
  "UCgNVXGlZIFK96XdEY20sVjg",
  "UCgRqGV1gBf2Esxh0Tz1vxzw",
  "UCgZuwn-O7Szh9cAgHqJ6vjw",
  "UChAnqc_AY5_I3Px5dig3X1Q",
  "UChgTyjG-pdNvxxhdsXfHQ5Q",
  "UCHj_mh57PVMXhAUDphUQDFA",
  "UC-hM6YJuNYVAmUWxeIr9FeA",
  "UChSvpZYRPh0FvG4SJGSga3g",
  "UCHsx4Hqa-1ORjQTh9TYDhww",
  "UCIBY1ollUsauvVi4hW4cumw",
  "UCJFZiqLMntJufDCHc6bQixg",
  "UCjLEmnpCNeisMxy134KPwWw",
  "UCK9V2B22uJYu3N7eR_BT9QA",
  "UCKeAhJvy8zgXWbh9duVjIaQ",
  "UCkT1u65YS49ca_LsFwcTakw",
  "UCKYyiJwNg2nV7hM86U5_wvw",
  "UCLbtM3JZfRTg8v2KGag-RMw",
  "UCl_gCybOJRIgOXw6Qb4qJzQ",
  "UCL_qhgtOy0dy1Agp8vkySQg",
  "UCmbs8T6MWqUHP1tIQvSgKrg",
  "UCMwGHR0BTZuLsmjY_NT5Pwg",
  "UCNoxM_Kxoa-_gOtoyjbux7Q",
  "UCnVbtCwr-5LXxUlGxsgD7sQ",
  "UCNVEsYbiZjH5QLmGeSgTSzg",
  "UCO_aKKYxn4tvrqPjcTzZ6EQ",
  "UCoSrY_IQQVpmIRZ9Xf-y93g",
  "UCotXwY6s8pWmuWd_snKYjhg",
  "UCOyYb1c43VlX9rc_lT6NKQw",
  "UCP0BspO_AMEe3aQqqpo89Dg",
  "UCp3tgHXw_HI0QMk1K8qh3gQ",
  "UCp-5t9SrOQwXMU7iIjQfARg",
  "UCp6993wxpyDPHUpavwDFqgg",
  "UCQ0UDLQCjY0rmuxCDE38FGg",
  "UCqm3BQLlJfvkTsX_hvm0UmA",
  "UCs9_O1tRPMQTHQ-N_L6FU2g",
  "UCS9uQI-jC3DE0L4IpXyvr6w",
  "UCsehvfwaWF6nWuFnXI0AqZQ",
  "UCsUj0dszADCGbF3gNrQEuSQ",
  "UCTvHWSfBZgtxE4sILOaurIQ",
  "UCu2DMOGLeR_DSStCyeQpi5Q",
  "UCUKD-uaobj9jiqB-VXt71mA",
  "UCvaTdHTWBGv3MKj3KVqJVCw",
  "UCvInZx9h3jC2JzsIzoOebWg",
  "UC_vMYWcDjmfdpH6r4TTn1MQ",
  "UCvzGlP9oQwU--Y0r9id_jnA",
  "UCwL7dgTxKo8Y4RFIKWaf8gA",
  "UCWsfcksUUpoEvhia0_ut0bA",
  "UCXTpFs_3PqI41qX2d9tL2Rw",
  "UCyl1z3jo3XHR1riLFKG5UAg",
  "UCYz_5n-uDuChHtLo7My1HnQ",
  "UCZgOv3YDEs-ZnZWDYVwJdmA",
  "UCZlDXzGoo7d44bwdNObFacg",
  "UCZLZ8Jjx_RN2CXloOmgTHVg",
];

function countUnique(model, { match, groupBy }) {
  return model.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: `$${groupBy}`,
        count: { $sum: 1 },
      },
    },
  ]);
}

async function main(argv) {
  await mongoose.connect(MONGO_URI);

  const time = Date.now();

  const result = await countUnique(Chat, {
    match: {
      originChannelId: {
        $in: HOLOLIVE_CHANNEL_IDS,
      },
      timestamp: {
        $gte: new Date(Date.UTC(2022, 1, 1)),
        $lt: new Date(Date.UTC(2022, 2, 1)),
      },
    },
    groupBy: "authorChannelId",
  });

  console.log(result, "took", (Date.now() - time) / 1000, "s");

  mongoose.disconnect();
}

main(process.argv.slice(2));
