# honeybee

## Create honeybee cluster

```bash
cp .env.placeholder .env
vim .env

docker swarm init --advertise-addr $(curl -s https://ifconfig.co)
docker network create -d overlay --attachable honeybee
docker stack deploy -c cluster.yml honeybee
```

```bash
# in master node
docker exec -it honeybee_mongo.1.<task_id> mongo -u honeybee
```

```js
use honeybee

db.createUser({
  user: "worker",
  pwd: passwordPrompt(), // or cleartext password
  roles: [{ role: "readWrite", db: "honeybee" }],
});
```

```js
authenticationRestrictions: [
  {
    clientSource: ["<ip|cidr>"],
  },
];
```

## Show cluster health

```bash
make stats
```

## Deploy additional nodes

```bash
cd tf
terraform init
terraform apply
```

### Teardown nodes

```bash
cd tf
terraform destroy
```

## Running migration task

```bash
NODE_OPTIONS=--max-old-space-size=32768 ts-node src/cli.ts --help
```

## References

- [docker-compose for Swarm: docker stack - Dots and Brackets: Code Blog](https://codeblog.dotsandbrackets.com/docker-stack/)
- [Deploy a stack to a swarm | Docker Documentation](https://docs.docker.com/engine/swarm/stack-deploy/)
