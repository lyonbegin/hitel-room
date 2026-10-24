FROM node:24-bookworm
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund --omit=optional
RUN npx playwright install --with-deps chromium
COPY . .
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node","server.mjs"]
