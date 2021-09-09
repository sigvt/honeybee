# Contribution Guide

## Local Development

```bash
yarn install
yarn dev
docker-compose build
docker-compose up
```

### inspect

```bash
MONGO_URI=mongodb://${MONGO_WORKER_USERNAME}:${MONGO_WORKER_PASSWORD}@localhost/${MONGO_DATABASE} node lib/index.js inspect
```
