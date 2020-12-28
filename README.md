# 🐝 Vespa

The final solution to the YouTube live chat trolls.

## key features

- Gradient Boosted Decision Tree for spotting suspicious chat
  - Hostile chat will be deleted.
  - Suspicious chat will be flagged as `spam` with the confidence score and can be shut out later by defining filtering rule
- Adaptive learning based off of moderator's activities
- Offers OBS-ready chat frame armed with customizable filter rules for extra security

## usage

```
docker-compose up -d
```

### Additional Worker

```bash
# in worklet
cat secret | docker login pkg.uechi.io --username <user> --password-stdin
docker run pkg.uechi.io/vespa-collector \
  -e JOB_CONCURRENCY=50 \
  -e MONGO_URI=mongodb://vespadb.forbital.com/vespa \
  -e REDIS_URI=redis://vespaq.forbital.com
```

## roadmap

- collector
  - [x] collect YouTube live chat and store it as JSON files.
  - [x] run as cluster and watch task queue
  - [ ] store chat to datastore
- trainer
  - [x] convert raw data into dataset for later use
  - [x] load dataset and learn spam detector
  - [ ] save weights for later use
  - [ ] load previously trained weights and fine-tune for new data
- predictor
  - [ ] JSON API that returns a given chat is spam or not
  - [ ] load weights and keep running as a HTTP server
- admin
  - [ ] annotate chat
- front
  - relay pushed actions stored in a database to the browser using websocket
  - create filter rules
  - show filtered chat window

## references

- https://github.com/xenova/chat-replay-downloader/blob/master/chat_replay_downloader.py
