package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"sync"
	"time"

	kafka "github.com/segmentio/kafka-go"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Document struct {
	ID              string    `bson:"id" json:"id"`
	AuthorChannelId string    `bson:"authorChannelId" json:"cid"`
	OriginChannelId string    `bson:"originChannelId" json:"ocid"`
	OriginVideoId   string    `bson:"originVideoId" json:"ovid"`
	AuthorName      string    `bson:"authorName" json:"author"`
	Message         string    `bson:"message" json:"msg"`
	IsModerator     bool      `bson:"isModerator" json:"mod"`
	IsOwner         bool      `bson:"isOwner" json:"owner"`
	IsVerified      bool      `bson:"isVerified" json:"verified"`
	Membership      string    `bson:"membership" json:"mem"`
	Timestamp       time.Time `bson:"timestamp" json:"ts"`
}

func getKafkaWriter(kafkaURL, topic string) *kafka.Writer {
	return &kafka.Writer{
		Addr:     kafka.TCP(kafkaURL),
		Topic:    topic,
		Balancer: &kafka.LeastBytes{},
	}
}

func iterateChangeStream(routineCtx context.Context, waitGroup sync.WaitGroup, stream *mongo.ChangeStream, docs chan Document) {
	defer stream.Close(routineCtx)
	defer waitGroup.Done()

	for stream.Next(routineCtx) {
		data := struct {
			Document Document `bson:"fullDocument"`
		}{}

		if err := stream.Decode(&data); err != nil {
			panic(err)
		}

		docs <- data.Document
	}

}

func sinkToKafka(routineCtx context.Context, kafkaWriter *kafka.Writer, docs chan Document, chanSize int) {
	var buf []kafka.Message
	var bufSize int = chanSize / 2

	invoked := time.Now()

	for data := range docs {
		res, err := json.Marshal(data)
		if err != nil {
			log.Fatalln(err)
			continue
		}
		msg := kafka.Message{
			Key:   []byte(fmt.Sprintf("id-%s", data.ID)),
			Value: res,
		}
		buf = append(buf, msg)

		if len(buf) > bufSize || time.Since(invoked).Seconds() > 5 {

			fmt.Printf("Sinking %v / %v\n", len(buf), len(docs))

			start := time.Now()
			// Sink to Kafka

			err = kafkaWriter.WriteMessages(routineCtx, buf...)

			if err != nil {
				log.Fatalln(err)
			}

			buf = []kafka.Message{}
			invoked = time.Now()

			fmt.Printf("Written %v (remaining %v)\n", time.Since(start), len(docs))
		}
	}
}

func main() {
	kafkaURL := os.Getenv("KAFKA_URI")
	topic := os.Getenv("KAFKA_TOPIC")
	mongoURL := os.Getenv("MONGO_URI")
	mongoDatabase := os.Getenv("MONGO_DATABASE")

	chanSize, _ := strconv.Atoi(os.Getenv("CONN_CHANNEL_CAPACITY"))

	// Kafka
	kafkaWriter := getKafkaWriter(kafkaURL, topic)

	defer kafkaWriter.Close()

	// MongoDB
	client, err := mongo.Connect(context.TODO(), options.Client().ApplyURI(mongoURL))

	if err != nil {
		panic(err)
	}

	defer client.Disconnect(context.TODO())

	database := client.Database(mongoDatabase)
	chatsCollection := database.Collection("chats")

	var waitGroup sync.WaitGroup

	chatsStream, err := chatsCollection.Watch(context.TODO(), mongo.Pipeline{})

	if err != nil {
		panic(err)
	}

	waitGroup.Add(1)

	routineCtx, cancelFn := context.WithCancel(context.Background())
	defer cancelFn()

	docs := make(chan Document, chanSize)

	go iterateChangeStream(routineCtx, waitGroup, chatsStream, docs)
	go sinkToKafka(context.Background(), kafkaWriter, docs, chanSize)

	waitGroup.Wait()
}
