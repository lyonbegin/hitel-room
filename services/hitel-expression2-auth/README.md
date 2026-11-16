# HITEL Expression 2 — HTTPS authentication gateway

Dedicated Railway service under HITEL-ROOM. Does NOT impersonate bitHuman licensing.

## Public protocol

- GET / — Korean informational page, no tokens
- GET /healthz — reachability/readiness hints
- POST /v1/auth/validate — bearer HITEL member JWT, product=expression-2, optional allowed agent_code
- POST /v1/meter/beats — HITEL bearer JWT and SDK metering payload, non-billing telemetry acknowledgment

## Security

The service forwards the bearer to the EXISTING HITEL API /v1/me endpoint to verify a real session. Missing/invalid tokens fail closed. CI fixture markers are explicitly rejected. No credentials in the source, binary, URL, logs, or response. HTTPS must be handled by Railway domain. Backend accepts only the public Wise Pup demo identity unless HITEL_EXPR2_PUBLIC_AGENTS is configured otherwise. A valid HITEL session **is not a bitHuman vendor license**.

## Railway

Create separate service, rootDirectory `/services/hitel-expression2-auth`, Dockerfile `Dockerfile`, healthcheck `/healthz`, set HITEL_AUTH_UPSTREAM to the production HTTPS HITEL API endpoint with GET /v1/me support. The service listens on Railway's PORT. Generate a Railway domain; then verify GET /healthz over public TLS and POST invalid bearer gives 401. Do not change existing HITEL-ROOM APIs.

## Device integration not yet done

The Flutter app must obtain a member token through HITEL login, use that token as the SDK bearer, then route the original SDK JVM metering base to this public HTTPS service. The original local model can still load from APK assets. Remove the localhost fixture from the public build. Do not ship the original DEBUG demo token or assume runtime success from build success.

## Production limitations

This is a first-party MVP authentication adapter, not a completed entitlement / licensing system, durable metering ledger, or official vendor authorization. Any production use requires appropriate SDK/model rights, logged-in membership and device authorization, persistent metering, audit and risk controls.
