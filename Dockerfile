FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY public ./public
COPY src ./src

RUN mkdir -p /app/data/uploads

EXPOSE 3000

CMD ["npm", "start"]
