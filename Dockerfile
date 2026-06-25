FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    NGINX_PORT=8080 \
    WEBSITES_PORT=8080

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 8080

CMD ["sh", "/app/docker/start.sh"]
