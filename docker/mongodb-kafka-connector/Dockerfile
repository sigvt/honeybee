# ref: https://github.com/confluentinc/demo-scene/blob/master/kafka-connect-zero-to-hero/docker-compose.yml

FROM confluentinc/cp-kafka-connect:latest

RUN confluent-hub install --no-prompt mongodb/kafka-connect-mongodb:latest

COPY entrypoint.sh /

CMD [ "/entrypoint.sh" ]
