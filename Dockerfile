FROM node:16-alpine

WORKDIR /app

# terraform deps
RUN apk add terraform --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community
RUN apk add git ruby ruby-dev docker-cli build-base openssh
RUN gem install json

# node modules
COPY package.json yarn.lock /app/
RUN yarn --frozen-lockfile

# masterchat dev
RUN git clone https://github.com/holodata/masterchat /masterchat && cd /masterchat && git checkout 912901cf9cea7469d9d02a01939b7b59aa0b59a6 && yarn install --frozen-lockfile && yarn build && yarn link
RUN yarn link masterchat

# build app
COPY tsconfig.json /app/
COPY src /app/src
RUN yarn build && yarn link

# terraform init
# COPY tf /app/tf
# WORKDIR /app/tf
# RUN terraform init -no-color -input=false
# WORKDIR /app

CMD ["honeybee", "worker"]
