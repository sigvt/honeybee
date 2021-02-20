FROM node:14

COPY package.json yarn.lock /app/
WORKDIR /app
RUN yarn --frozen-lockfile

COPY src /app/src
COPY tsconfig.json /app/
RUN yarn build

CMD ["node", "./lib/worker.js"]