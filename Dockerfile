FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80
ENV ONLINE_LOG_PATH=/data/online.csv

RUN mkdir -p /data && chown -R node:node /data

COPY server.mjs ./
COPY --from=build /app/dist ./dist

EXPOSE 80

USER node

CMD ["node", "server.mjs"]
