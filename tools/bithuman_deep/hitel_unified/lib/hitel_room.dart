import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:http/http.dart' as http;

typedef Json = Map<String, dynamic>;

// This is the original iOS IPA's Railway public-room contract, not the Fly
// mediasoup protocol. The latter must have an independent transport adapter.
class HitelPublicRoomApi {
  HitelPublicRoomApi({http.Client? client, Uri? origin})
      : _http = client ?? http.Client(),
        origin = origin ?? Uri.parse('https://hitel-room-production-ecce.up.railway.app');
  final http.Client _http;
  final Uri origin;
  String? _token;
  Future<dynamic> _request(String path, {String method = 'GET', Json? body}) async {
    final request = http.Request(method, origin.resolve(path));
    request.headers['Cache-Control'] = 'no-store';
    if (_token != null) request.headers['Authorization'] = 'Bearer $_token';
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    final response = await http.Response.fromStream(await _http.send(request).timeout(const Duration(seconds: 15)));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.statusCode == 401) _token = null;
      throw StateError('HITEL HTTP ${response.statusCode}');
    }
    return response.body.isEmpty ? null : jsonDecode(response.body);
  }
  Future<void> authenticate(String userId, String name) async {
    _token = null;
    final value = await _request('/api/auth/dev-token', method: 'POST', body: {
      'userId': userId, 'name': name, 'platformRole': 'user',
    });
    final token = value['accessToken'];
    if (token is! String || token.isEmpty) throw StateError('JWT missing');
    _token = token;
  }
  static bool joinable(Json room) => room['status'] == 'LIVE' &&
      room['type'] == 'PUBLIC_ROOM' &&
      room['policy'] is Map && room['policy']['allowUnlistedParticipants'] == true;
  Future<List<Json>> rooms() async =>
      (await _request('/api/public-rooms') as List).map((v) => Json.from(v as Map)).where(joinable).toList();
  Future<Json> create(String title, int capacity) async {
    if (title.trim().isEmpty || capacity < 2 || capacity > 32) throw ArgumentError('방 이름 및 정원 확인');
    final room = Json.from(await _request('/api/public-rooms', method: 'POST',
        body: {'title': title.trim(), 'maxParticipants': capacity}) as Map);
    if (!joinable(room)) throw StateError('서버가 참가 가능한 방을 반환하지 않았습니다');
    return room;
  }
  String _roomPath(String id) => '/api/public-rooms/${Uri.encodeComponent(id)}';
  Future<String> join(String id) async {
    final data = Json.from(await _request('${_roomPath(id)}/join', method: 'POST') as Map);
    final session = Json.from(data['session'] as Map);
    if (session['id'] != id || !joinable(session) || data['ticket'] is! String ||
        (data['ticket'] as String).isEmpty) throw StateError('방 접속권 검증 실패');
    return data['ticket'] as String;
  }
  Future<WebSocket> signal(String id, String ticket) => WebSocket.connect(
    origin.resolve('${_roomPath(id)}/signal').replace(scheme: origin.scheme == 'https' ? 'wss' : 'ws').toString(),
    protocols: ['hitel-public', 'ticket.$ticket'],
  ).timeout(const Duration(seconds: 12));
  Future<void> end(String id) async { await _request('${_roomPath(id)}/end', method: 'POST'); }
  void close() => _http.close();
}

class _Peer {
  _Peer(this.pc, this.renderer);
  final RTCPeerConnection pc;
  final RTCVideoRenderer renderer;
  final List<RTCIceCandidate> pending = [];
  RTCRtpSender? videoSender;
  bool remoteSet = false;
  bool receivedFrame = false;
  Future<void> close() async {
    renderer.srcObject = null;
    await pc.close();
    await pc.dispose();
    await renderer.dispose();
  }
}

// A single capture owner; the same local track is sent to each participant.
// No direct audio player is created for calls. Remote audio is played by WebRTC.
class HitelRoomSession extends ChangeNotifier {
  HitelRoomSession(this.api);
  final HitelPublicRoomApi api;
  final RTCVideoRenderer local = RTCVideoRenderer();
  final Map<String, _Peer> _peers = {};
  Map<String, RTCVideoRenderer> get remoteRenderers =>
      _peers.map((id, p) => MapEntry(id, p.renderer));
  int get renderedPeers => _peers.values.where((p) => p.receivedFrame).length;
  MediaStream? _stream;
  WebSocket? _socket;
  StreamSubscription<dynamic>? _subscription;
  Future<void> _serial = Future.value();
  String? roomId;
  String status = '대기';
  bool welcomed = false;
  bool mic = true;
  bool camera = true;
  String videoMode = 'camera';
  bool changingVideo = false;
  bool _disposed = false;
  bool _localInitialized = false;
  Future<void>? _leaving;
  int _epoch = 0;
  void _status(String value) { status = value; if (!_disposed) notifyListeners(); }
  bool _current(int epoch) => !_disposed && epoch == _epoch;
  Future<void> start(String id) async {
    await _leaving;
    if (roomId != null || _disposed) throw StateError('이미 방에 참여 중');
    final epoch = ++_epoch;
    roomId = id;
    welcomed = false;
    try {
      if (!_localInitialized) { await local.initialize(); _localInitialized = true; }
      if (!_current(epoch)) return;
      final stream = await navigator.mediaDevices.getUserMedia({
        'audio': true, 'video': {'facingMode': 'user', 'width': 640, 'height': 480, 'frameRate': 25}
      });
      if (!_current(epoch)) { for (final t in stream.getTracks()) { await t.stop(); } await stream.dispose(); return; }
      _stream = stream;
      local.srcObject = stream;
      final ticket = await api.join(id);
      if (!_current(epoch)) return;
      final socket = await api.signal(id, ticket);
      if (!_current(epoch)) { await socket.close(); return; }
      _socket = socket;
      final ready = Completer<void>();
      _subscription = socket.listen((raw) {
        _serial = _serial.then((_) async {
          if (!_current(epoch)) return;
          final value = Json.from(jsonDecode(raw is String ? raw : utf8.decode(raw as List<int>)) as Map);
          await _handle(value, epoch);
          if (welcomed && !ready.isCompleted) ready.complete();
        }).catchError((Object e, StackTrace s) {
          if (!ready.isCompleted) ready.completeError(e, s);
          if (_current(epoch)) _status('시그널링 오류: $e');
        });
      }, onError: (Object e) {
        if (!ready.isCompleted) ready.completeError(e);
        if (_current(epoch)) unawaited(leave(message: '연결 오류: $e'));
      }, onDone: () {
        if (!ready.isCompleted) ready.completeError(StateError('welcome 전 연결 종료'));
        if (_current(epoch)) unawaited(leave(message: '서버 연결 종료'));
      });
      await ready.future.timeout(const Duration(seconds: 12));
    } catch (e) {
      if (_current(epoch)) await leave(message: '입장 실패: $e');
      rethrow;
    }
  }
  void _send(String to, Json data) {
    final socket = _socket;
    if (socket == null) return;
    socket.add(jsonEncode({'type':'signal', 'to':to, 'data':data}));
  }
  Future<_Peer> _peer(String id, int epoch) async {
    final existing = _peers[id];
    if (existing != null) return existing;
    final renderer = RTCVideoRenderer();
    await renderer.initialize();
    final pc = await createPeerConnection({
      'sdpSemantics': 'unified-plan',
      'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]
    });
    final p = _Peer(pc, renderer);
    if (!_current(epoch)) { await p.close(); throw StateError('session closed'); }
    _peers[id] = p;
    renderer.onFirstFrameRendered = () {
      if (_current(epoch) && _peers[id] == p) { p.receivedFrame = true; _status('상대 영상 수신 · $renderedPeers명'); }
    };
    pc.onTrack = (event) {
      if (_current(epoch) && event.track.kind == 'video' && event.streams.isNotEmpty) {
        renderer.srcObject = event.streams.first;
        _status('상대 영상 트랙 수신 · 프레임 대기');
      }
    };
    pc.onIceCandidate = (c) {
      if (_current(epoch) && c.candidate != null) {
        _send(id, {'candidate': {'candidate': c.candidate, 'sdpMid': c.sdpMid, 'sdpMLineIndex': c.sdpMLineIndex}});
      }
    };
    pc.onIceConnectionState = (state) {
      if (_current(epoch)) _status('$id ICE: ${state.name}');
    };
    final stream = _stream!;
    for (final track in stream.getTracks()) {
      final sender = await pc.addTrack(track, stream);
      if (track.kind == 'video') p.videoSender = sender;
    }
    if (!_current(epoch)) { _peers.remove(id); await p.close(); throw StateError('session closed'); }
    if (!_disposed) notifyListeners();
    return p;
  }
  Future<void> _description(String id, _Peer p, bool offer) async {
    final description = offer ? await p.pc.createOffer() : await p.pc.createAnswer();
    await p.pc.setLocalDescription(description);
    _send(id, {'description': {'type': description.type, 'sdp': description.sdp}});
  }
  Future<void> _handle(Json data, int epoch) async {
    final type = data['type'];
    if (type == 'welcome') {
      for (final item in data['peers'] as List? ?? []) {
        final id = item['peerId'];
        if (id is String) await _peer(id, epoch);
      }
      welcomed = true;
      _status('방 입장 확인 · 상대 미디어 대기');
    } else if (type == 'peer-joined') {
      final id = data['peerId'];
      if (id is String) { final p = await _peer(id, epoch); await _description(id, p, true); }
    } else if (type == 'peer-left') {
      await _peers.remove(data['peerId'])?.close();
      _status('참가자 퇴장 · ${_peers.length}명');
    } else if (type == 'room-ended') {
      await leave(message: '방 종료');
    } else if (type == 'signal') {
      final id = data['from'];
      if (id is! String || data['data'] is! Map) return;
      final p = await _peer(id, epoch);
      final signal = Json.from(data['data'] as Map);
      final desc = signal['description'];
      if (desc is Map && (desc['type'] == 'offer' || desc['type'] == 'answer')) {
        await p.pc.setRemoteDescription(RTCSessionDescription(desc['sdp'] as String, desc['type'] as String));
        p.remoteSet = true;
        for (final candidate in p.pending) { await p.pc.addCandidate(candidate); }
        p.pending.clear();
        if (desc['type'] == 'offer') await _description(id, p, false);
      }
      final ice = signal['candidate'];
      if (ice is Map && ice['candidate'] is String) {
        final c = RTCIceCandidate(ice['candidate'] as String, ice['sdpMid'] as String?, (ice['sdpMLineIndex'] as num?)?.toInt());
        if (p.remoteSet) { await p.pc.addCandidate(c); } else { p.pending.add(c); }
      }
    }
  }
  void toggleMic() {
    mic = !mic;
    for (final t in _stream?.getAudioTracks() ?? <MediaStreamTrack>[]) { t.enabled = mic; }
    if (!_disposed) notifyListeners();
  }
  void toggleCamera() {
    camera = !camera;
    for (final t in _stream?.getVideoTracks() ?? <MediaStreamTrack>[]) { t.enabled = camera; }
    if (!_disposed) notifyListeners();
  }
  Future<void> switchCamera() async {
    if (videoMode != 'camera') throw StateError('ARCore는 전면 카메라 전용입니다');
    final tracks = _stream?.getVideoTracks();
    if (tracks != null && tracks.isNotEmpty) await Helper.switchCamera(tracks.first);
  }
  // Serialized with offer/answer handling: one physical camera at a time.
  Future<void> selectVideoMode(String mode) {
    if (!Platform.isAndroid && mode == 'mask') return Future.error(UnsupportedError('Android ARCore only; native iOS app preserved'));
    if (mode != 'camera' && mode != 'mask') return Future.error(ArgumentError(mode));
    final epoch = _epoch;
    final task = _serial.then((_) async {
      if (!_current(epoch) || _stream == null || !welcomed || mode == videoMode) return;
      changingVideo = true; _status('영상 소스 전환 중');
      final previous = videoMode;
      try {
        await _replaceVideo(mode, epoch);
        videoMode = mode;
        _status(mode == 'mask' ? 'ARCore 영상 트랙 연결 · 실제 가면 검증 필요' : '일반 카메라 트랙 연결');
      } catch (error) {
        if (_current(epoch)) {
          try { await _replaceVideo(previous, epoch); videoMode = previous; }
          catch (_) { _status('카메라 복구 실패 · 방 재입장 필요'); }
        }
        rethrow;
      } finally { changingVideo = false; if (!_disposed) notifyListeners(); }
    });
    _serial = task.catchError((Object _, StackTrace __) {});
    return task;
  }
  Future<void> _replaceVideo(String mode, int epoch) async {
    final stream = _stream!;
    for (final p in _peers.values) { await p.videoSender?.replaceTrack(null); }
    local.srcObject = null;
    for (final old in stream.getVideoTracks().toList()) {
      await stream.removeTrack(old); await old.stop();
    }
    final temp = await navigator.mediaDevices.getUserMedia({
      'audio': false, 'video': {
        'facingMode': 'user', 'width': 640, 'height': 480, 'frameRate': 25,
        if (mode == 'mask') 'hitelMode': 'mask',
      }
    });
    final video = temp.getVideoTracks().single;
    await temp.removeTrack(video);
    await temp.dispose();
    if (!_current(epoch)) { await video.stop(); return; }
    try {
      video.enabled = camera;
      await stream.addTrack(video);
      for (final p in _peers.values) { await p.videoSender?.replaceTrack(video); }
      local.srcObject = stream;
    } catch (_) { await stream.removeTrack(video); await video.stop(); rethrow; }
  }
  Future<void> leave({String message = '방 퇴장'}) {
    final inProgress = _leaving;
    if (inProgress != null) return inProgress;
    final task = _leave(message);
    _leaving = task;
    return task.whenComplete(() { if (identical(_leaving, task)) _leaving = null; });
  }
  Future<void> _leave(String message) async {
    ++_epoch;
    roomId = null;
    welcomed = false;
    final sub = _subscription; _subscription = null;
    final socket = _socket; _socket = null;
    final peers = _peers.values.toList(); _peers.clear();
    final stream = _stream; _stream = null;
    if (_localInitialized) local.srcObject = null;
    await sub?.cancel();
    await socket?.close();
    for (final p in peers) { await p.close(); }
    if (stream != null) { for (final t in stream.getTracks()) { await t.stop(); } await stream.dispose(); }
    mic = true; camera = true; videoMode = 'camera';
    _status(message);
  }
  Future<void> shutdown() async {
    _disposed = true;
    await leave();
    if (_localInitialized) await local.dispose();
    api.close();
    super.dispose();
  }
}
