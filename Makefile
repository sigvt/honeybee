all: build stop start logs

build:
	docker-compose -f docker-compose.production.yml build

stop:
	docker-compose -f docker-compose.production.yml down

start:
	docker-compose -f docker-compose.production.yml up -d

logs:
	docker-compose -f docker-compose.production.yml logs -f worker scheduler
