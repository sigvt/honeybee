# 🍯🐝 honeybee

![Header](https://raw.githubusercontent.com/uetchy/honeybee/master/.github/header.png)

Honeybee is a distributed YouTube live chat and moderation events collector.

## How it works

- Fetch streams index from Holodex (every 10 minutes)
- Queue newly scheduled streams to a job pool
- One of the cluster members takes it and start collecting events

## Spin up a cluster

```bash
cp .env.placeholder .env
vim .env

docker swarm init --advertise-addr $(curl -s https://api.ipify.org)
docker network create -d overlay --attachable honeybee
docker stack deploy -c cluster.yml hb
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

## Employ external nodes

```bash
cd tf
terraform init -upgrade
terraform apply -var total_workers=3

docker node ls # list nodes
docker node promote <node> # promote more than 2 nodes as managers in case of changing ip address of main node
```

### Teardown external nodes

```bash
docker node rm -f <node>
cd tf
terraform destroy
```

## Contribute

Have ideas to improve the system? Please [open an issue](https://github.com/holodata/honeybee/issues), or join `#honeybee` channel on [holodata Discord](https://holodata.org/discord).
