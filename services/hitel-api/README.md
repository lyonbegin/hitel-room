# HITEL platform API (FastAPI)

A standalone control-plane MVP for phone verification, device capability
registration, and interaction metadata. It is **not** a telephony media server.
It does not modify the existing Fly WebRTC service.

## Local setup

```bash
python -m pip install -r services/hitel-api/requirements.txt
export HITEL_DATABASE_URL=sqlite:///./hitel-dev.db
export HITEL_JWT_SECRET="$(python -c 'import secrets;print(secrets.token_urlsafe(48))')"
# Production: configure database, HTTPS SMS sending adapter, permitted web origins.
uvicorn app.main:app --app-dir services/hitel-api --host 0.0.0.0 --port 8000
```

Required SMS env vars: `HITEL_SMS_PROVIDER_URL` (HTTPS POST endpoint accepting
`{"to": "+821012345678", "message": "..."}`) and `HITEL_SMS_PROVIDER_TOKEN`.
This integration contract is designed for a trusted SMS adapter service. When
it is not configured, phone onboarding responds HTTP 503 rather than creating
unverified phone identities. Codes are never returned to clients or logged.

`HITEL_CORS_ORIGINS` is a comma-separated explicit origin allowlist.
For production choose a persistent PostgreSQL URL and manage schema migrations
separately (the initial version auto-creates the tables).

Run tests with `PYTHONPATH=services/hitel-api pytest -q services/hitel-api/tests`.
