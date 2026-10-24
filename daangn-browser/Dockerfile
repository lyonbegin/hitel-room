FROM node:24-bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-noto-cjk fonts-noto-color-emoji ca-certificates procps libnss3 libasound2 libgbm1 libatk-bridge2.0-0 libgtk-3-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . ./
ENV CHROME_PATH=/usr/bin/chromium
EXPOSE 8080
CMD ["node","server.cjs"]
