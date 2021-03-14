# 🍯🐝 honeybee

![Header](https://raw.githubusercontent.com/uetchy/honeybee/master/.github/header.png)

## Spin up a cluster

```bash
cp .env.placeholder .env
vim .env

docker swarm init --advertise-addr $(curl -s https://ifconfig.co/ip)
docker network create -d overlay --attachable honeybee
docker stack deploy -c cluster.yml hb
```

```bash
# in master node
docker exec -it hb_mongo.1.<task_id> mongo -u honeybee
```

```js
use honeybee

db.createUser({
  user: "worker",
  pwd: passwordPrompt(), // or cleartext password
  roles: [{ role: "readWrite", db: "honeybee" }],
});
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
docker run --rm --network honeybee -it \
  -e MONGO_URI=mongodb://${MONGO_WORKER_USERNAME}:${MONGO_WORKER_PASSWORD}@mongo/honeybee \
  -e REDIS_URI=redis://:${REDIS_PASSWORD}@redis \
  -e NODE_OPTIONS=--max-old-space-size=32768 \
  ${HONEYBEE_IMAGE} \
  honeybee --help
```
