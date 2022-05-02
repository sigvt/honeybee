# Contribution Guide

## Local development

```bash
cp .env.placeholder .env
vim .env
yarn install
yarn dev
docker-compose build
docker-compose up
docker-compose exec mongo mongo
> rs.initiate()
exit
```

### Inspect

```bash
MONGO_URI=mongodb://localhost/honeybee lib/index.js inspect
```

## Bootstrapping a production cluster

```bash
cp .env.placeholder .env
vim .env

mkdir -p $DATA_DIR/{redis,mongo,cache}

docker swarm init --advertise-addr $(curl -s https://api.ipify.org)
docker network create -d overlay --attachable --subnet=<cidr-addr> honeybee
docker stack deploy -c docker-compose.production.yml hb
```

```bash
# in main node
make logindb
```

```js
db.createUser({
  user: "worker",
  pwd: passwordPrompt(), // or cleartext password
  roles: [{ role: "readWrite", db: "honeybee" }],
});
```

```bash
sed -i "s/MONGO_WORKER_PASSWORD=/MONGO_WORKER_PASSWORD=<password>/" .env
```

## Cluster health

```bash
make health
```

## MongoDB

```js
db.chats.aggregate([
  {
    $match: {
      originChannelId: "",
      timestamp: { $gt: new Date(2021, 9, 7) },
      authorName: "",
    },
  },
  {
    $project: {
      timestamp: 1,
      msg: {
        $reduce: {
          input: "$message",
          initialValue: "",
          in: { $concat: ["$$value", "$$this.text"] },
        },
      },
    },
  },
  { $match: { msg: { $ne: null } } },
  { $sort: { timestamp: 1 } },
]);
```

## MongoDB Change Stream

### Enable replica set

[Convert a Standalone to a Replica Set — MongoDB Manual](https://docs.mongodb.com/manual/tutorial/convert-standalone-to-replica-set/)

```bash
openssl rand -base64 756 > /path/to/keyfile
chmod 400 /path/to/keyfile
chown 999:999 /path/to/keyfile
echo "MONGO_RS_KEYFILE=/path/to/keyfile" >> .env

make deploy
make logindb
```

then:

```js
rs.initiate();
rs.conf();
rs.status();
```

### Subscribe change stream (deprecated)

```js
const mongoose = require("mongoose");
const Chat = require("./lib/models/Chat.js").default;
const Deletion = require("./lib/models/Deletion.js").default;
const BanAction = require("./lib/models/BanAction.js").default;

async function main() {
  await mongoose.connect("mongodb://localhost/honeybee");

  Deletion.watch([
    {
      $match: { operationType: "insert", "fullDocument.retracted": false },
    },
  ]).on("change", async ({ fullDocument }) => {
    const chat = await Chat.findOne({ id: fullDocument.targetId });
    console.log("deleted", chat);
  });

  BanAction.watch([
    {
      $match: { operationType: "insert" },
    },
  ]).on("change", async ({ fullDocument }) => {
    const chat = await Chat.findOne({
      authorChannelId: fullDocument.channelId,
    });
    console.log("banned", chat);
  });
}

main();
```

## Redpanda (Go-based Kafka)

```bash
rpk cluster config set auto_create_topics_enabled true
rpk redpanda mode production
rpk redpanda tune all
rpk acl user create admin -p <password> --api-urls localhost:9644
rpk topic describe test-topic --user admin --password <password> --sasl-mechanism SCRAM-SHA-256 --brokers localhost:9092
```

```bash
# Show
rpk cluster info

# List
rpk topic list

# Consume
rpk topic consume --offset end chats

# Delete
rpk topic delete chats
```

## Groonga

```bash
docker-compose exec groonga groonga -n /mnt/db/data.db
docker-compose exec groonga groonga /mnt/db/data.db status
```
