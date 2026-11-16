"""Real Railway public room API + two authenticated browser signaling clients."""
import os
import tempfile
from pathlib import Path
import pytest

os.environ.setdefault("HITEL_DATABASE_URL","sqlite:///"+str(Path(tempfile.mkdtemp())/"rooms.db"))
os.environ.setdefault("HITEL_JWT_SECRET","test-secret-for-railway-public-rooms-20261103-1234567890")

from fastapi.testclient import TestClient
from app import main,public_rooms

@pytest.fixture
def client(monkeypatch):
    async def auth(token):
        if token not in ("host","guest","guest2","intruder"):
            raise AssertionError("unexpected mock auth token")
        return token, token+" name"
    monkeypatch.setattr(public_rooms,"verified_identity",auth)
    with TestClient(main.app) as c:
        yield c

def headers(user):
    return {"Authorization":"Bearer "+user}

def create(client):
    res=client.post("/v1/public-rooms",headers=headers("host"),
                    json={"title":"실제 공개 영상방","maxParticipants":3})
    assert res.status_code==201,res.text
    return res.json()

def test_create_without_invitations_and_list(client):
    room=create(client)
    assert room["type"]=="PUBLIC_ROOM"
    assert room["status"]=="LIVE"
    assert room["policy"]["allowUnlistedParticipants"] is True
    assert room["hostUserIds"]==["host"]
    assert len(room["participants"])==1
    listed=client.get("/v1/public-rooms",headers=headers("guest"))
    assert listed.status_code==200
    assert room["id"] in [x["id"] for x in listed.json()]

def test_guest_can_enter_no_invite_and_host_only_close(client):
    room=create(client);id=room["id"]
    joined=client.post(f"/v1/public-rooms/{id}/join",headers=headers("guest"))
    assert joined.status_code==200
    assert joined.json()["ticket"]
    assert joined.json()["session"]["id"]==id
    denied=client.post(f"/v1/public-rooms/{id}/end",headers=headers("intruder"))
    assert denied.status_code==403
    ended=client.post(f"/v1/public-rooms/{id}/end",headers=headers("host"))
    assert ended.status_code==200
    assert ended.json()["session"]["status"]=="ENDED"
    assert id not in [x["id"] for x in client.get("/v1/public-rooms",headers=headers("guest")).json()]

def test_authenticated_two_socket_signaling_and_peer_lifecycle(client):
    room=create(client);id=room["id"]
    host=client.post(f"/v1/public-rooms/{id}/join",headers=headers("host")).json()["ticket"]
    guest=client.post(f"/v1/public-rooms/{id}/join",headers=headers("guest")).json()["ticket"]
    with client.websocket_connect(f"/v1/public-rooms/{id}/signal",subprotocols=["hitel-public","ticket."+host]) as ws_host:
        a=ws_host.receive_json()
        assert a["type"]=="welcome" and a["peers"]==[]
        with client.websocket_connect(f"/v1/public-rooms/{id}/signal",subprotocols=["hitel-public","ticket."+guest]) as ws_guest:
            b=ws_guest.receive_json()
            assert b["type"]=="welcome" and len(b["peers"])==1
            joined=ws_host.receive_json()
            assert joined["type"]=="peer-joined"
            assert joined["peerId"]==b["peerId"]
            ws_host.send_json({"type":"signal","to":b["peerId"],"data":{
                "description":{"type":"offer","sdp":"v=0"}}})
            offer=ws_guest.receive_json()
            assert offer["type"]=="signal"
            assert offer["from"]==a["peerId"]
            assert offer["data"]["description"]["type"]=="offer"
        left=ws_host.receive_json()
        assert left["type"]=="peer-left"

def test_ticket_cannot_be_reused(client):
    room=create(client);id=room["id"]
    token=client.post(f"/v1/public-rooms/{id}/join",headers=headers("guest")).json()["ticket"]
    with client.websocket_connect(f"/v1/public-rooms/{id}/signal",subprotocols=["hitel-public","ticket."+token]) as ws:
        assert ws.receive_json()["type"]=="welcome"
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/v1/public-rooms/{id}/signal",subprotocols=["hitel-public","ticket."+token]) as ws:
            ws.receive_json()
