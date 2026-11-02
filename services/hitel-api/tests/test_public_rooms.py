import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock
import jwt
import pytest

os.environ.setdefault("HITEL_DATABASE_URL",f"sqlite:///{Path(tempfile.mkdtemp())/'public-room-test.db'}")
os.environ.setdefault("HITEL_JWT_SECRET","only-for-tests-very-long-random-test-secret-key-20261102")

from fastapi.testclient import TestClient
from app import main
from app import public_rooms

def session_data(open_policy=True):
    return {
        "id":"room-test-123", "title":"공개 영상방","status":"WAITING",
        "hostUserIds":["host-1"],
        "policy":{"allowUnlistedParticipants":open_policy,"maxParticipants":8},
        "participants":[{"userId":"host-1","ready":False}]
    }

def token(uid):
    return jwt.encode({"sub":uid,"exp":9999999999},"arbitrary-signature",algorithm="HS256")

def test_public_list_and_host_only_registration(monkeypatch):
    monkeypatch.setattr(public_rooms, "upstream", AsyncMock(return_value=session_data()))
    with TestClient(main.app) as c:
        assert c.get("/v1/public-rooms").status_code==200
        payload={"id":"room-test-123","hostUserId":"host-1"}
        res=c.post("/v1/public-rooms",json=payload,headers={"Authorization":"Bearer "+token("host-1")})
        assert res.status_code==201,res.text
        assert len(c.get("/v1/public-rooms").json()["rooms"])>=1
        other=c.post("/v1/public-rooms",json=payload,headers={"Authorization":"Bearer "+token("guest-2")})
        assert other.status_code==403

def test_public_room_guest_may_fetch_existing_server_session(monkeypatch):
    monkeypatch.setattr(public_rooms, "upstream", AsyncMock(return_value=session_data()))
    with TestClient(main.app) as c:
        res=c.post("/v1/public-rooms/room-test-123/join",json={},
                   headers={"Authorization":"Bearer "+token("guest-2")})
        assert res.status_code==200,res.text
        assert res.json()["session"]["id"]=="room-test-123"

def test_denied_policy_never_lists_fake_open_room(monkeypatch):
    monkeypatch.setattr(public_rooms, "upstream", AsyncMock(return_value=session_data(False)))
    with TestClient(main.app) as c:
        res=c.post("/v1/public-rooms",json={"id":"room-test-no-open","hostUserId":"host-1"},
                   headers={"Authorization":"Bearer "+token("host-1")})
        assert res.status_code in (409,502)
