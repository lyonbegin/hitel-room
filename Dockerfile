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
FROM nginx:1.27-alpine
ENV TEST_LOGIN_KEY=""
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=android-original-build /android-original/dist /usr/share/nginx/html/android-original
# Only this frame adapter is new; the MIT-licensed Android upstream UI stays intact.
COPY android-viewer/phone.html /usr/share/nginx/html/stream/ci-playstore/phone.html
COPY --from=video-core-build /video-core/dist/sdk /usr/share/nginx/html/sdk/video-core
COPY --from=video-core-build /video-core/public/sdk-playground.html /usr/share/nginx/html/sdk-playground.html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
