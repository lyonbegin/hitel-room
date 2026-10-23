FROM node:22-bookworm-slim
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends chromium fonts-noto-cjk ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY review/server.cjs ./server.cjs
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node","server.cjs"]
