# Build the SDK from the existing authoritative video-town-front repository.
FROM node:22-alpine AS video-core-build
RUN apk add --no-cache git
ARG VIDEO_CORE_REF=d67601e5efdf26ef16668b5e8b343d355bf85b29
RUN git clone --depth 1 https://github.com/lyonbegin/video-town-front.git /video-core \
    && cd /video-core \
    && git checkout "$VIDEO_CORE_REF" \
    && npm install --no-audit --no-fund \
    && npm run build:sdk

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build
FROM nginx:1.27-alpine
ENV TEST_LOGIN_KEY=""
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=video-core-build /video-core/dist/sdk /usr/share/nginx/html/sdk
COPY --from=video-core-build /video-core/public/sdk-playground.html /usr/share/nginx/html/sdk-playground.html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
