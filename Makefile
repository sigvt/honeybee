all: build push deploy ps

build:
	docker-compose build --pull

push:
	docker-compose push

stop:
	docker stack rm vespa

deploy:
	docker stack deploy -c cluster.yml --with-registry-auth vespa

logs:
	concurrently --names "SCHEDULER,WORKER" "docker service logs -f vespa_scheduler" "docker service logs -f vespa_worker"

ps:
	docker stack ps vespa

health:
	docker run --rm --network vespa -it -e MONGO_URI=mongodb://${MONGO_WORKER_USERNAME}:${MONGO_WORKER_PASSWORD}@mongo/vespa -e REDIS_URI=redis://:${REDIS_PASSWORD}@redis ${HONEYBEE_IMAGE} honeybee health
