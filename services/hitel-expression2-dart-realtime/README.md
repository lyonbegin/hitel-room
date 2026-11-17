# HITEL Expression 2 Dart Realtime WebSocket (Railway)

This deploys the original bitHuman 2.6.37 Dart `mock_realtime` package,
*not* the commercial bitHuman realtime relay or an AI speech/TTS service.

- Original source: `vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/e2e/mock_realtime/`
- Public health: `GET /healthz`
- Public WebSocket: `wss://<service-domain>/v1/realtime?model=gpt-realtime-mini`
- Mandatory `Authorization: Bearer <HITEL session token>` before WebSocket upgrade
- Auth verified over HTTPS against existing HITEL Expresssion 2 `POST /v1/auth/validate`
- No embedded credentials, no production vendor license bypass, no vendor code edits
- The original mock binds loopback *inside* the container; the public proxy owns port `PORT`
- Protocol: session.created, session.update, response.create, response.output_audio.delta, response.output_audio_transcript.delta, response.cancelled, response.done
- Audio is synthetic deterministic PCM16 at 24 kHz; not actual speech
- Demo endpoints are diagnostic-only, not production AI responses.

Railway config: existing `HITEL-ROOM` project, separate service, source `lyonbegin/hitel-room` branch `feature/bithuman-expression2-imx-sdk-audit-20261112`, repository-root Docker context, Dockerfile `services/hitel-expression2-dart-realtime/Dockerfile`, healthcheck `/healthz`. Optional `HITEL_EXPR2_AUTH_URL` must be an HTTPS HITEL authorization gateway, default `https://hitel-expression2-auth-production.up.railway.app`.

Android Flutter **debug** APK can set `--dart-define=BITHUMAN_REALTIME_WS_URL=wss://<domain>/v1/realtime?model=gpt-realtime-mini`. Release builds intentionally ignore this debug override. The existing HITEL demo-session flow provides a scoped bearer token; no static APK secrets.

Security: only validated HITEL bearer sessions are upgraded, limits 12 sockets/24 pending handshakes, 6,000 client events per connection, 64KiB max event, 15-minute connection cap. Invalid or unavailable auth fails closed. Browser support needs a separate compatible authentication mechanism; it is not enabled by making this URL public.

Validation: GET /healthz=200, missing bearer WSS=401, valid HITEL demo bearer yields session.created and 24kHz PCM test deltas. Actual Expression 2 native face-frame output must be verified separately on Android.
