all: build stop start logs

build:
	docker-compose build

stop:
	docker-compose down

start:
	docker-compose up -d

logs:
	docker-compose logs -f worker scheduler
