FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:20-bookworm-slim

WORKDIR /app

RUN sed -i 's|deb.debian.org/debian|mirrors.aliyun.com/debian|g; s|security.debian.org/debian-security|mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources \
  && apt-get update \
  && apt-get -o Acquire::Retries=10 install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY public ./public
COPY src ./src

RUN mkdir -p /app/data/uploads

EXPOSE 3000

CMD ["npm", "start"]
