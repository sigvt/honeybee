#!/bin/bash

/etc/confluent/docker/run &

HOST=http://localhost:8083/connectors

# https://developer.confluent.io/learn-kafka/kafka-connect/docker/
echo "Waiting for Kafka Connect to start listening on localhost ⏳"
while : ; do
  curl_status=$(curl -s -o /dev/null -w %{http_code} $HOST)
  echo -e $(date) " Kafka Connect listener HTTP state: " $curl_status " (waiting for 200)"
  if [ $curl_status -eq 200 ] ; then
    break
  fi
  sleep 5
done

echo "Creating a source 🥫"
# https://docs.mongodb.com/kafka-connector/master/quick-start/
# https://docs.mongodb.com/kafka-connector/current/source-connector/configuration-properties
# https://docs.mongodb.com/kafka-connector/v1.3/introduction/converters/#std-label-string-converter-sample-properties
curl -X POST -H "Content-Type: application/json" $HOST -d '
{
    "name": "mongo-source",
    "config": {
        "connector.class": "com.mongodb.kafka.connect.MongoSourceConnector",
        "connection.uri": "mongodb://db:27017/?replicaSet=hb0",
        "database": "honeybee",
        "collection": "chats",
        "output.json.formatter": "com.mongodb.kafka.connect.source.json.formatter.SimplifiedJson",
        "output.format.value": "json",
        "output.format.key": "json",
        "key.converter.schemas.enable": false,
        "value.converter.schemas.enable": false,
        "key.converter": "org.apache.kafka.connect.storage.StringConverter",
        "value.converter": "org.apache.kafka.connect.storage.StringConverter",
        "publish.full.document.only": true,
        "pipeline": "[{\"$match\": {\"operationType\": \"insert\"}}]"
    }
}'

sleep infinity
