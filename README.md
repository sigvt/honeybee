# 🍯🐝 honeybee

![Header](https://raw.githubusercontent.com/uetchy/honeybee/master/.github/header.png)

## Spin up a cluster

```bash
cp .env.placeholder .env
vim .env

docker swarm init --advertise-addr $(curl -s https://api.ipify.org)
docker network create -d overlay --attachable honeybee
docker stack deploy -c cluster.yml hb
```

```bash
# in master node
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

## Deploy additional worker nodes

```bash
cd tf
terraform init
terraform apply -var total_workers=5
```

### Teardown workers

```bash
cd tf
terraform destroy
```

## Run one-shot task

```bash
./hb --help
```
