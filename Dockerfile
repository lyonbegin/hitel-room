# Build the SDK from the existing authoritative video-town-front repository.
FROM node:22-alpine AS video-core-build
RUN apk add --no-cache git
ARG VIDEO_CORE_REF=d67601e5efdf26ef16668b5e8b343d355bf85b29
RUN git clone --depth 1 https://github.com/lyonbegin/video-town-front.git /video-core \
    && cd /video-core \
    && git checkout "$VIDEO_CORE_REF" \
    && npm install --no-audit --no-fund \
    && npm run build:sdk

# Build the original upstream Android Emulator Platform UI unmodified.
# CLI --base determines only the mount path on the existing HITEL website.
FROM node:22-alpine AS android-original-build
WORKDIR /android-original
COPY vendor/android-emulator-platform/frontend/package.json ./
RUN npm install --no-audit --no-fund
COPY vendor/android-emulator-platform/frontend ./
RUN npm run build -- --base /android-original/ && test -s dist/index.html

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json vite.config.ts vite.communication-sdk.config.ts index.html ./
COPY src ./src
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_HITEL_PLATFORM_API_URL=
ENV VITE_HITEL_PLATFORM_API_URL=$VITE_HITEL_PLATFORM_API_URL
RUN npm run build && npx vite build --config vite.communication-sdk.config.ts
# Small Railway Sandbox control API runs in the ALREADY-EXISTING web
# container. This does NOT provision a permanent relay or emulator.
FROM node:22-alpine AS sandbox-sdk-build
WORKDIR /srv/hitel-sandbox
RUN npm init -y && npm install --omit=dev --no-audit --no-fund railway ws@8.18.3

# Host the real open-source noVNC frontend on the same Railway web origin.
FROM alpine:3.20 AS novnc-build
RUN apk add --no-cache git \
 && git clone --depth 1 --branch v1.6.0 https://github.com/novnc/noVNC.git /novnc

FROM nginx:1.27-alpine
ENV TEST_LOGIN_KEY=""
# Node 22 binary from the SDK build stage; nginx remains the web gateway.
RUN apk add --no-cache libstdc++
COPY --from=sandbox-sdk-build /usr/local/bin/node /usr/local/bin/node
COPY --from=sandbox-sdk-build /srv/hitel-sandbox/node_modules /srv/hitel-sandbox/node_modules
COPY sandbox-control/server.mjs /srv/hitel-sandbox/server.mjs
COPY sandbox-control/kvm-control.mjs /srv/hitel-sandbox/kvm-control.mjs
# Keep official nginx entrypoint intact so /etc/nginx/templates/*.template
# is rendered before nginx starts. The prior shell CMD bypassed this step.
COPY sandbox-control/35-hitel-sandbox.sh /docker-entrypoint.d/35-hitel-sandbox.sh
RUN chmod +x /docker-entrypoint.d/35-hitel-sandbox.sh

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=novnc-build /novnc /usr/share/nginx/html/lab-kvm/novnc
COPY lab-kvm/phone.html /usr/share/nginx/html/lab-kvm/novnc/phone.html
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=android-original-build /android-original/dist /usr/share/nginx/html/android-original
COPY --from=video-core-build /video-core/dist/sdk /usr/share/nginx/html/sdk/video-core
COPY --from=video-core-build /video-core/public/sdk-playground.html /usr/share/nginx/html/sdk-playground.html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
