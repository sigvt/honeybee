all: build push deploy ps

build:
	docker-compose build --pull

push:
	docker-compose push

stop:
	docker stack rm hb

deploy:
	docker stack deploy -c cluster.yml --with-registry-auth hb

logs:
	concurrently --names "SCHEDULER,WORKER" "docker service logs -f --tail=1000 hb_scheduler" "docker service logs -f --tail=1000 hb_worker"

ps:
	docker stack ps hb

health:
	docker run --rm --network honeybee -it -e MONGO_URI=mongodb://${MONGO_WORKER_USERNAME}:${MONGO_WORKER_PASSWORD}@mongo/${MONGO_DATABASE} -e REDIS_URI=redis://:${REDIS_PASSWORD}@redis ${HONEYBEE_IMAGE} honeybee health

logindb:
	docker exec -it $$(docker ps --filter name=hb_mongo --format '{{.Names}}') mongo -u ${MONGO_INITDB_ROOT_USERNAME} -p ${MONGO_INITDB_ROOT_PASSWORD} --authenticationDatabase admin ${MONGO_DATABASE}

sh: build
	docker run --rm --network honeybee -it -e MONGO_URI=mongodb://${MONGO_WORKER_USERNAME}:${MONGO_WORKER_PASSWORD}@mongo/${MONGO_DATABASE} -e REDIS_URI=redis://:${REDIS_PASSWORD}@redis ${HONEYBEE_IMAGE} sh