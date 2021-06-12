FROM node:16-alpine

COPY package.json yarn.lock /app/
WORKDIR /app
RUN yarn --frozen-lockfile

COPY tsconfig.json /app/
COPY src /app/src
RUN yarn build && yarn link

CMD ["honeybee", "worker"]
