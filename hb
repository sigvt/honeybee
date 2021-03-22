#!/bin/bash

docker run --rm -it \
  --network honeybee \
  -e MONGO_URI=mongodb://${MONGO_WORKER_USERNAME}:${MONGO_WORKER_PASSWORD}@mongo/${MONGO_DATABASE} \
  -e REDIS_URI=redis://:${REDIS_PASSWORD}@redis \
  ${HONEYBEE_IMAGE} sh -c "honeybee $@"