import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock

dbfile = Path(tempfile.mkdtemp()) / "hitel-test.db"
os.environ["HITEL_DATABASE_URL"] = f"sqlite:///{dbfile}"
os.environ["HITEL_JWT_SECRET"] = "test-only-not-for-production-" + ("long-random-value-" * 4)

from fastapi.testclient import TestClient
from app import main

def client():
    return TestClient(main.app)

def onboard(phone, code, mock):
    main.deliver_sms = mock
    c = client()
    with c:
        r = c.post("/v1/auth/otp/request", json={"phone": phone})
        assert r.status_code == 202, r.text
        response = c.post("/v1/auth/otp/verify", json={"phone": phone, "code": code})
        assert response.status_code == 200, response.text
        return response.json()["access_token"]

def test_health_and_missing_provider():
    with client() as c:
        assert c.get("/health").json()["ok"]
        assert c.post("/v1/auth/otp/request", json={"phone": "010-1234-5678"}).status_code == 503

def test_otp_does_not_leak_code_and_rejects_guess(monkeypatch):
    fake = AsyncMock()
    with client() as c:
        monkeypatch.setattr(main, "deliver_sms", fake)
        assert c.post("/v1/auth/otp/request", json={"phone": "010-2345-6789"}).status_code == 202
        assert c.post("/v1/auth/otp/request", json={"phone": "010-2345-6789"}).status_code == 429
        for _ in range(5):
            assert c.post("/v1/auth/otp/verify", json={"phone": "010-2345-6789", "code": "111111"}).status_code in (400, 200)
        assert c.post("/v1/auth/otp/verify", json={"phone": "010-2345-6789", "code": "111111"}).status_code == 400
        assert c.post("/v1/auth/otp/request", json={"phone": "000000"}).status_code == 422

def test_device_registration_and_interaction_isolation(monkeypatch):
    sent = {}
    async def sms(to, code):
        sent[to] = code
    monkeypatch.setattr(main, "deliver_sms", sms)
    with client() as c:
        def verify(phone):
            assert c.post("/v1/auth/otp/request", json={"phone": phone}).status_code == 202
            res = c.post("/v1/auth/otp/verify", json={"phone": phone, "code": sent[main.kr_mobile(phone)]})
            assert res.status_code == 200
            return res.json()["access_token"]
        a = verify("010-1234-5678")
        b = verify("010-8765-4321")
        ah = {"Authorization": f"Bearer {a}"}
        bh = {"Authorization": f"Bearer {b}"}
        assert c.get("/v1/devices").status_code == 401
        assert c.post("/v1/devices", json={"device_id": "android-device-001", "platform": "android", "capabilities": {"ttsLocal": True}}, headers=ah).status_code == 201
        assert c.post("/v1/devices", json={"device_id": "android-device-001", "platform": "android"}, headers=bh).status_code == 409
        assert len(c.get("/v1/devices", headers=ah).json()["devices"]) == 1
        assert c.get("/v1/devices", headers=bh).json()["devices"] == []
        assert c.post("/v1/interactions", json={"purpose": "tutoring", "channel": "WEBRTC"}, headers=ah).status_code == 201
        assert len(c.get("/v1/interactions", headers=ah).json()["interactions"]) == 1
        assert c.get("/v1/interactions", headers=bh).json()["interactions"] == []
