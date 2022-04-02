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
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Event struct {
	Ns           Ns       `bson:"ns"`
	OpType       string   `bson:"operationType"`
	FullDocument bson.Raw `bson:"fullDocument"`
}

type Ns struct {
	Coll string `bson:"coll"`
	Db   string `bson:"db"`
}

type Chat struct {
	ID              string    `bson:"id" json:"id"`
	AuthorChannelId string    `bson:"authorChannelId" json:"cid"`
	OriginChannelId string    `bson:"originChannelId" json:"ocid"`
	OriginVideoId   string    `bson:"originVideoId" json:"ovid"`
	AuthorName      string    `bson:"authorName" json:"aut"`
	Message         string    `bson:"message" json:"msg"`
	Timestamp       time.Time `bson:"timestamp" json:"ts"`
	IsModerator     bool      `bson:"isModerator" json:"mod"`
	IsOwner         bool      `bson:"isOwner" json:"own"`
	IsVerified      bool      `bson:"isVerified" json:"vrf"`
	Membership      string    `bson:"membership" json:"mem"`
}

type SuperChat struct {
	ID              string    `bson:"id" json:"id"`
	AuthorChannelId string    `bson:"authorChannelId" json:"cid"`
	OriginChannelId string    `bson:"originChannelId" json:"ocid"`
	OriginVideoId   string    `bson:"originVideoId" json:"ovid"`
	AuthorName      string    `bson:"authorName" json:"aut"`
	Message         string    `bson:"message" json:"msg"`
	Timestamp       time.Time `bson:"timestamp" json:"ts"`
	Currency        string    `bson:"currency" json:"cur"`
	Amount          float64   `bson:"purchaseAmount" json:"amo"`
	Significance    int       `bson:"significance" json:"sig"`
}

type SuperSticker struct {
	ID              string    `bson:"id" json:"id"`
	AuthorChannelId string    `bson:"authorChannelId" json:"cid"`
	OriginChannelId string    `bson:"originChannelId" json:"ocid"`
	OriginVideoId   string    `bson:"originVideoId" json:"ovid"`
	AuthorName      string    `bson:"authorName" json:"aut"`
	Text            string    `bson:"text" json:"txt"`
	Timestamp       time.Time `bson:"timestamp" json:"ts"`
	Currency        string    `bson:"currency" json:"cur"`
	Amount          float64   `bson:"purchaseAmount" json:"amo"`
}

type Membership struct {
	ID              string    `bson:"id" json:"id"`
	AuthorChannelId string    `bson:"authorChannelId" json:"cid"`
	OriginChannelId string    `bson:"originChannelId" json:"ocid"`
	OriginVideoId   string    `bson:"originVideoId" json:"ovid"`
	AuthorName      string    `bson:"authorName" json:"aut"`
	Timestamp       time.Time `bson:"timestamp" json:"ts"`
	Level           string    `bson:"level" json:"lv"`
	Since           string    `bson:"since" json:"s"`
}

type Milestone struct {
	ID              string    `bson:"id" json:"id"`
	AuthorChannelId string    `bson:"authorChannelId" json:"cid"`
	OriginChannelId string    `bson:"originChannelId" json:"ocid"`
	OriginVideoId   string    `bson:"originVideoId" json:"ovid"`
	AuthorName      string    `bson:"authorName" json:"aut"`
	Message         string    `bson:"message" json:"msg"`
	Timestamp       time.Time `bson:"timestamp" json:"ts"`
	Level           string    `bson:"level" json:"lv"`
	Since           string    `bson:"since" json:"s"`
}

type Ban struct {
	ID              string    `bson:"_id" json:"oid"`
	ChannelId       string    `bson:"channelId" json:"cid"`
	OriginChannelId string    `bson:"originChannelId" json:"ocid"`
	OriginVideoId   string    `bson:"originVideoId" json:"ovid"`
	Timestamp       time.Time `bson:"timestamp" json:"ts"`
}

type Deletion struct {
	ID              string    `bson:"_id" json:"oid"`
	TargetId        string    `bson:"targetId" json:"tid"`
	OriginChannelId string    `bson:"originChannelId" json:"ocid"`
	OriginVideoId   string    `bson:"originVideoId" json:"ovid"`
	Timestamp       time.Time `bson:"timestamp" json:"ts"`
	Retracted       bool      `bson:"retracted" json:"r"`
}

type Watch struct {
	channel     chan interface{}
	kafkaWriter *kafka.Writer
}

type KafkaWatch struct {
	watches map[string]Watch
}

func (c *KafkaWatch) AddWatcher(kafkaURL string, topic string, channelSize int) {
	c.watches[topic] = Watch{
		channel:     make(chan interface{}, channelSize),
		kafkaWriter: getKafkaWriter(kafkaURL, topic),
	}
}

func (c *KafkaWatch) Start() {
	for _, listener := range c.watches {
		go sinkToKafka(context.Background(), listener.kafkaWriter, listener.channel)
	}
}

func (c *KafkaWatch) Consume(topic string, doc interface{}) {
	c.watches[topic].channel <- doc
}

func toKafkaMessage(data interface{}) (kafka.Message, error) {
	var res []byte
	var key []byte
	var err error

	switch data := data.(type) {
	case Chat:
		res, err = json.Marshal(data)
		if err != nil {
			return kafka.Message{}, err
		}
		key = []byte(fmt.Sprintf("ct-%s", data.ID))

	case SuperChat:
		res, err = json.Marshal(data)
		if err != nil {
			return kafka.Message{}, err
		}
		key = []byte(fmt.Sprintf("sc-%s", data.ID))

	case SuperSticker:
		res, err = json.Marshal(data)
		if err != nil {
			return kafka.Message{}, err
		}
		key = []byte(fmt.Sprintf("stk-%s", data.ID))

	case Membership:
		res, err = json.Marshal(data)
		if err != nil {
			return kafka.Message{}, err
		}
		key = []byte(fmt.Sprintf("mem-%s", data.ID))

	case Milestone:
		res, err = json.Marshal(data)
		if err != nil {
			return kafka.Message{}, err
		}
		key = []byte(fmt.Sprintf("mil-%s", data.ID))

	case Ban:
		res, err = json.Marshal(data)
		if err != nil {
			return kafka.Message{}, err
		}
		key = []byte(fmt.Sprintf("ban-%s", data.ID))

	case Deletion:
		res, err = json.Marshal(data)
		if err != nil {
			return kafka.Message{}, err
		}
		key = []byte(fmt.Sprintf("del-%s", data.ID))
	}

	return kafka.Message{
		Key:   key,
		Value: res,
	}, nil
}

func getKafkaWriter(kafkaURL, topic string) *kafka.Writer {
	return &kafka.Writer{
		Addr:     kafka.TCP(kafkaURL),
		Topic:    topic,
		Balancer: &kafka.LeastBytes{},
	}
}

func sinkToKafka(routineCtx context.Context, kafkaWriter *kafka.Writer, docs chan interface{}) {
	defer kafkaWriter.Close()

	var buf []kafka.Message
	var bufSize int = cap(docs) / 2

	topic := kafkaWriter.Topic
	invoked := time.Now()

	for data := range docs {
		msg, err := toKafkaMessage(data)
		if err != nil {
			log.Fatalln(err)
			continue
		}

		buf = append(buf, msg)

		if time.Since(invoked).Seconds() > 1 || len(buf) > bufSize {
			fmt.Printf("Sinking %v %v / %v ... ", len(buf), topic, len(docs))

			start := time.Now()

			err = kafkaWriter.WriteMessages(routineCtx, buf...)

			if err != nil {
				log.Fatalln(err)
			}

			buf = []kafka.Message{}
			invoked = time.Now()

			fmt.Printf("Written %v %v (remaining %v)\n", time.Since(start), topic, len(docs))
		}
	}
}

func iterateChangeStream(routineCtx context.Context, waitGroup sync.WaitGroup, stream *mongo.ChangeStream, wt KafkaWatch) {
	defer stream.Close(routineCtx)
	defer waitGroup.Done()

	for stream.Next(routineCtx) {
		data := Event{}

		if err := stream.Decode(&data); err != nil {
			panic(err)
		}

		switch data.Ns.Coll {
		case "chats":
			var chat Chat
			if err := bson.Unmarshal(data.FullDocument, &chat); err != nil {
				panic(err)
			}
			wt.Consume("chats", chat)

		case "superchats":
			var superchat SuperChat
			if err := bson.Unmarshal(data.FullDocument, &superchat); err != nil {
				panic(err)
			}
			wt.Consume("superchats", superchat)

		case "superstickers":
			var supersticker SuperSticker
			if err := bson.Unmarshal(data.FullDocument, &supersticker); err != nil {
				panic(err)
			}
			wt.Consume("superstickers", supersticker)

		case "memberships":
			var membership Membership
			if err := bson.Unmarshal(data.FullDocument, &membership); err != nil {
				panic(err)
			}
			wt.Consume("memberships", membership)

		case "milestones":
			var milestone Milestone
			if err := bson.Unmarshal(data.FullDocument, &milestone); err != nil {
				panic(err)
			}
			wt.Consume("milestones", milestone)

		case "banactions":
			var ban Ban
			if err := bson.Unmarshal(data.FullDocument, &ban); err != nil {
				panic(err)
			}
			wt.Consume("banactions", ban)

		case "deleteactions":
			var deletion Deletion
			if err := bson.Unmarshal(data.FullDocument, &deletion); err != nil {
				panic(err)
			}
			wt.Consume("deleteactions", deletion)
		}
	}
}

func main() {
	kafkaURL := os.Getenv("KAFKA_URI")
	mongoURL := os.Getenv("MONGO_URI")
	mongoDatabase := os.Getenv("MONGO_DATABASE")
	chanSize, _ := strconv.Atoi(os.Getenv("CONN_CHANNEL_CAPACITY"))

	// Kafka
	kw := KafkaWatch{watches: make(map[string]Watch)}
	kw.AddWatcher(kafkaURL, "chats", chanSize)
	kw.AddWatcher(kafkaURL, "superchats", chanSize)
	kw.AddWatcher(kafkaURL, "superstickers", chanSize)
	kw.AddWatcher(kafkaURL, "memberships", chanSize)
	kw.AddWatcher(kafkaURL, "milestones", chanSize)
	kw.AddWatcher(kafkaURL, "banactions", chanSize)
	kw.AddWatcher(kafkaURL, "deleteactions", chanSize)
	go kw.Start()

	// MongoDB
	client, err := mongo.Connect(context.TODO(), options.Client().ApplyURI(mongoURL))
	if err != nil {
		panic(err)
	}

	defer client.Disconnect(context.TODO())

	database := client.Database(mongoDatabase)
	pipeline := []bson.M{
		{"$match": bson.M{"operationType": "insert"}},
	}

	changeStream, err := database.Watch(context.TODO(), pipeline)
	if err != nil {
		panic(err)
	}

	var waitGroup sync.WaitGroup
	waitGroup.Add(1)

	routineCtx, cancelFn := context.WithCancel(context.Background())
	defer cancelFn()

	go iterateChangeStream(routineCtx, waitGroup, changeStream, kw)

	waitGroup.Wait()
}
