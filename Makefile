all: build push deploy ps

build:
	docker-compose build

push:
	docker-compose push

stop:
	docker stack rm vespa

deploy:
	docker stack deploy -c cluster.yml --with-registry-auth vespa

ps:
	docker stack ps vespa

logs:
	docker service logs -f vespa_worker

stats:
	docker run --rm --network vespa -it -e MONGO_URI=mongodb://${MONGO_WORKER_USERNAME}:${MONGO_WORKER_PASSWORD}@mongo/vespa -e REDIS_URI=redis://:${REDIS_PASSWORD}@redis ${HONEYBEE_IMAGE} node lib/cli.js stats
