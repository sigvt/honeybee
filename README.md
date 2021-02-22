# honeybee

```bash
NODE_OPTIONS=--max-old-space-size=32768 ts-node src/cli.ts
```

## Configure

### Start scheduler and datastore

```bash
docker stack deploy -c docker-compose.production.yml
```

### Add worker

```bash
# in master node
docker-compose exec db mongo -u vespa -p
```

```js
use vespa

db.createUser({
  user: "worker",
  pwd: passwordPrompt(), // or cleartext password
  roles: [{ role: "readWrite", db: "vespa" }],
});
```

```js
authenticationRestrictions: [
  {
    clientSource: ["<ip|cidr>"],
  },
];
```

```bash
# in worklet
cat <secret> | docker login pkg.uechi.io --username <user> --password-stdin
docker run \
  -e JOB_CONCURRENCY=100 \
  -e MONGO_URI=mongodb://<user>:<pwd>@<host>:<port>/<db> \
  -e REDIS_URI=redis://<user>:<password>@<host>:<port> \
  --name vespa-worker \
  --restart unless-stopped \
  -d \
  pkg.uechi.io/vespa-honeybee
```

### Remove worker

```bash
# in worklet
docker rm vespa-worker
```

```js
use vespa
db.dropUser("worker-tokyo1")
show users
```

## Show stats

```bash
docker-compose exec worker node lib/cli.js stats
```
