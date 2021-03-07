FROM node:15-alpine

COPY package.json yarn.lock /app/
WORKDIR /app
RUN yarn --frozen-lockfile

COPY src /app/src
COPY tsconfig.json /app/
RUN yarn build
RUN yarn link

CMD ["honeybee", "worker"]
