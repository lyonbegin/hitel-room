# Build from the GitHub repository root (Railway rootDirectory=/).
# The original bitHuman mock_realtime Dart package is copied byte-for-byte.
FROM dart:stable AS build
WORKDIR /work
COPY vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/e2e/mock_realtime /work/vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/e2e/mock_realtime
COPY services/hitel-expression2-dart-realtime /work/services/hitel-expression2-dart-realtime
WORKDIR /work/services/hitel-expression2-dart-realtime
RUN dart pub get && dart analyze bin/server.dart && dart compile exe bin/server.dart -o /work/hitel-realtime

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /work/hitel-realtime /app/hitel-realtime
ENV PORT=8080
EXPOSE 8080
CMD ["/app/hitel-realtime"]
