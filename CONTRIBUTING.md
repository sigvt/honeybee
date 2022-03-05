# Contribution Guide

## Local Development

```bash
yarn install
yarn dev
docker-compose build
docker-compose up
```

### inspect

```bash
MONGO_URI=mongodb://localhost/honeybee lib/index.js inspect
```

## Spin up a cluster

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

## Show cluster health

```bash
make health
```

## MongoDB Query

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
