FROM node:14

COPY package.json yarn.lock /app/
WORKDIR /app
RUN yarn --frozen-lockfile

COPY . /app
RUN yarn build

CMD ["node", "./lib/worker.js"]