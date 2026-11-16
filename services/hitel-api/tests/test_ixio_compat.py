"""IXIO wire-shape compatibility checks against real HITEL OTP membership.

Tests run with isolated sqlite and fake SMS delivery. They do not contact any
carrier / Firebase / production API and never print actual auth credentials.
"""
from __future__ import annotations

import base64
import hashlib
import os
import secrets
import tempfile
from pathlib import Path

os.environ.setdefault("HITEL_DATABASE_URL", f"sqlite:///{Path(tempfile.mkdtemp()) / 'compat.db'}")
os.environ.setdefault("HITEL_JWT_SECRET", "test-only-ixio-compat-jwt-key-" + "many-random-bytes-for-tests")
from fastapi.testclient import TestClient
from app import main


def onboard(c: TestClient, phone: str, codes: dict) -> tuple[str, str]:
    response = c.post("/v1/auth/otp/request", json={"phone": phone})
    assert response.status_code == 202, response.text
    canonical = main.kr_mobile(phone)
    code = codes[canonical]
    response = c.post("/v1/auth/otp/verify", json={"phone": phone, "code": code})
    assert response.status_code == 200, response.text
    x = response.json()
    return x["access_token"], x["user_id"]


def test_routes_are_opt_in_and_original_api_is_unchanged(monkeypatch):
    monkeypatch.setenv("HITEL_IXIO_COMPAT_ENABLED", "false")
    with TestClient(main.app) as c:
        assert c.get("/health").status_code == 200
        r = c.post("/v1/members/verify-ctn", json={"ctn": "some-ciphertext-abcdefgh"})
        assert r.status_code == 503
        assert c.post("/v1/auth/otp/request", json={"phone": "abc"}).status_code == 422


def test_hitel_verified_ctn_enrollment_and_member_isolation(monkeypatch):
    monkeypatch.setenv("HITEL_IXIO_COMPAT_ENABLED", "true")
    monkeypatch.setenv("HITEL_IXIO_ALLOW_SELF_ENROLL", "false")
    codes = {}
    async def fake_sms(to, code):
        codes[to] = code
    monkeypatch.setattr(main, "deliver_sms", fake_sms)
    with TestClient(main.app) as c:
        a, a_id = onboard(c, "010-1234-1201", codes)
        b, b_id = onboard(c, "010-1234-1202", codes)
        a_headers = {"Authorization": f"Bearer {a}"}
        b_headers = {"Authorization": f"Bearer {b}"}
        assert c.post("/v1/members/verify-ctn",
                      json={"ctn": "untrusted-ciphertext-attempt"}).json()["code"] == "ERROR_INVALID_CTN"
        assert c.post("/hitel/ixio/ctn-proof").status_code == 401
        proof = c.post("/hitel/ixio/ctn-proof", headers=a_headers).json()
        assert proof["encoding"] == "HITEL_JWT_CTN_PROOF"
        response = c.post("/v1/members/verify-ctn",
                          json={"ctn": proof["ctn"]}).json()
        assert response == {"code": "SUCCESS", "message": "OK",
                            "data": {"isRegistered": True}}
        query = {"userVersion": "1", "model": "test-emulator", "osVersion": "34", "os": "Android"}
        assert c.get("/v2/service", params=query).status_code == 401
        assert c.get("/v2/service", params=query, headers=a_headers).json()["data"]["isJoined"] is False
        assert c.get("/v2/service", params=query, headers=b_headers).json()["data"]["isJoined"] is False
        assert c.post("/v2/service", json={"prodCd": "INVALID"},headers=a_headers).json()["code"] == "ERROR_UNKNOWN_PRODUCT"
        assert c.post("/v2/service", json={"prodCd": "HITEL_DEVELOPMENT"},
                      headers=a_headers).json()["code"] == "ERROR_ENROLLMENT_REQUIRES_APPROVAL"
        monkeypatch.setenv("HITEL_IXIO_ALLOW_SELF_ENROLL", "true")
        assert c.post("/v2/service", json={"prodCd": "HITEL_DEVELOPMENT"},
                      headers=a_headers).json()["code"] == "SUCCESS"
        d=c.get("/v2/service",params=query,headers=a_headers).json()["data"]
        assert set(d) == {"isJoined", "deviceSeed", "isPufKms"}
        assert d["isJoined"] is True
        assert c.get("/v2/service", params=query, headers=b_headers).json()["data"]["isJoined"] is False
        assert c.post("/ctn", json={"ctn": "01012341202"}, headers=a_headers).status_code == 403
        p = c.post("/ctn", json={"ctn": main.kr_mobile("010-1234-1201")}, headers=a_headers).json()
        assert p["data"] == {"ctn": main.kr_mobile("010-1234-1201"), "isCtn": True}
        assert c.delete("/v2/service", headers=a_headers).json()["code"] == "SUCCESS"
        assert c.get("/v2/service",params=query,headers=a_headers).json()["data"]["isJoined"] is False


def test_one_time_pkce_and_hitel_refresh_credential(monkeypatch):
    # This test covers the real authenticated API contract, not the
    # isolated GitHub Actions QA fixture enabled in the emulator job.
    monkeypatch.setenv("HITEL_IXIO_CI_FIXTURE_ENABLED", "false")
    monkeypatch.setenv("HITEL_IXIO_COMPAT_ENABLED", "true")
    codes = {}
    async def fake_sms(to, code): codes[to] = code
    monkeypatch.setattr(main, "deliver_sms", fake_sms)
    with TestClient(main.app) as c:
        token,user_id = onboard(c, "010-1234-1203", codes)
        headers = {"Authorization": f"Bearer {token}"}
        verifier = secrets.token_urlsafe(40)
        challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        state = secrets.token_urlsafe(24)
        assert c.post("/hitel/ixio/auth-code/start",
                      json={"state":state,"codeChallenge":challenge}).status_code == 401
        grant=c.post("/hitel/ixio/auth-code/start",
                     json={"state":state,"codeChallenge":challenge},
                     headers=headers)
        assert grant.status_code == 200
        code=grant.json()["authCode"]
        assert c.post("/auth-code",json={"authCode":code,"state":state,
                     "codeVerifier":verifier+"wrong"}).json()["code"] == "ERROR_INVALID_GRANT"
        x=c.post("/auth-code",json={"authCode":code,"state":state,
                "codeVerifier":verifier}).json()
        assert x["code"] == "SUCCESS"
        assert set(x["data"]) == {
            "accessToken","refreshToken","idToken","tokenType","name",
            "email","gender","birthdate","marketId","authUrl"
        }
        assert x["data"]["accessToken"] != x["data"]["refreshToken"]
        assert c.post("/auth-code",json={"authCode":code,"state":state,
                     "codeVerifier":verifier}).json()["code"] == "ERROR_INVALID_GRANT"
        refreshed=c.post("/autologin",json={"userId":user_id},
                         headers={"Authorization":f"Bearer {x['data']['refreshToken']}"})
        assert refreshed.status_code == 200,refreshed.text
        assert refreshed.json()["code"] == "SUCCESS"
        assert c.post("/autologin",json={"userId":"unrelated-id"},
                      headers={"Authorization":f"Bearer {x['data']['refreshToken']}"}).status_code == 403
        assert c.post("/autologin",json={"userId":user_id},
                      headers={"Authorization":f"Bearer {x['data']['accessToken']}"}).status_code == 401
        assert c.get("/login").json()["code"] == "ERROR_NOT_CONFIGURED"


def test_ci_only_appauth_redirect_matches_manifest_and_pkce(monkeypatch):
    """Synthetic HITEL QA authorization: exact original APK redirect scheme."""
    from urllib.parse import parse_qs, urlsplit
    monkeypatch.setenv("HITEL_IXIO_COMPAT_ENABLED", "true")
    monkeypatch.setenv("HITEL_IXIO_CI_FIXTURE_ENABLED", "true")
    phone = "010-1234-1204"
    monkeypatch.setenv("HITEL_IXIO_CI_PHONE", main.kr_mobile(phone))
    monkeypatch.setenv("HITEL_IXIO_CI_ASSERTION", "qa_fixture_" + "a" * 48)
    codes = {}
    async def fake_sms(to, code):
        codes[to] = code
    monkeypatch.setattr(main, "deliver_sms", fake_sms)
    with TestClient(main.app) as c:
        onboard(c, phone, codes)
        cfg = c.get("/login").json()["data"]
        assert cfg["authUri"] == "hitel/qa/authorize"
        redirect = cfg["callbackUrl"]
        assert redirect.startswith("com.lguplus.aicallagent:")
        verifier = secrets.token_urlsafe(40)
        challenge = base64.urlsafe_b64encode(
            hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        state = secrets.token_urlsafe(24)
        params = {
            "redirect_uri": redirect,
            "client_id": cfg["clientId"],
            "response_type": "code",
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "login_hint": main.kr_mobile(phone),
            "scope": "openid profile",
        }
        bad = c.get("/hitel/qa/authorize",
                    params={**params, "redirect_uri": "hitel-qa://auth/callback"},
                    follow_redirects=False)
        assert bad.status_code == 400
        good = c.get("/hitel/qa/authorize",
                     params=params, follow_redirects=False)
        assert good.status_code == 302
        location = good.headers["location"]
        assert location.startswith(redirect + "?")
        parsed = parse_qs(urlsplit(location).query)
        assert parsed["state"][0] == state
        code = parsed["code"][0]
        token = c.post("/auth-code", json={
            "authCode": code, "state": state, "codeVerifier": verifier,
        }).json()
        assert token["code"] == "SUCCESS"
        assert token["data"]["accessToken"]
        reused = c.post("/auth-code", json={
            "authCode": code, "state": state, "codeVerifier": verifier,
        }).json()
        assert reused["code"] == "ERROR_INVALID_GRANT"
        monkeypatch.setenv("HITEL_IXIO_CI_FIXTURE_ENABLED", "false")
        denied = c.get("/hitel/qa/authorize",
                       params=params, follow_redirects=False)
        assert denied.status_code == 404
