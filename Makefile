all: build push deploy ps

build:
	docker-compose build --pull

push:
	docker-compose push

stop:
	docker stack rm hb

deploy:
	docker stack deploy -c docker-compose.production.yml --with-registry-auth hb

logs:
	docker service logs --tail=20000 -t -f hb_worker 2>&1 | grep -iE 'required|<!>|unrecognized|unhandled'

schLogs:
	docker service logs -f -t --raw hb_scheduler 2>&1

ps:
	docker stack ps hb -f 'desired-state=running'

sh:
	docker run --rm --network ${HONEYBEE_NETWORK} -it -e MONGO_URI=mongodb://${MONGO_WORKER_USERNAME}:${MONGO_WORKER_PASSWORD}@mongo/${MONGO_DATABASE} -e REDIS_URI=redis://:${REDIS_PASSWORD}@redis -v $(CURDIR)/lib:/app/lib -v /tmp/holodex:/holodexCache -e CACHE_PATH=/holodexCache ${HONEYBEE_IMAGE} sh

logindb:
	docker exec -it $$(docker ps --filter name=hb_mongo --format '{{.Names}}') mongo -u ${MONGO_INITDB_ROOT_USERNAME} -p ${MONGO_INITDB_ROOT_PASSWORD} --authenticationDatabase admin ${MONGO_DATABASE}

showWaitingJobs:
	docker service logs -t --raw hb_scheduler|grep -E 'Waiting=[^0]'
