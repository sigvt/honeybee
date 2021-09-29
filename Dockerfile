FROM node:16-alpine

WORKDIR /app

# terraform
RUN apk add terraform --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community
RUN apk add git ruby ruby-dev docker-cli build-base
RUN gem install json
COPY tf /app/tf
WORKDIR /app/tf
RUN terraform init -no-color -input=false
WORKDIR /app

# node modules
COPY package.json yarn.lock /app/
RUN yarn --frozen-lockfile

# build app
COPY tsconfig.json /app/
COPY src /app/src
RUN yarn build && yarn link

CMD ["honeybee", "worker"]
