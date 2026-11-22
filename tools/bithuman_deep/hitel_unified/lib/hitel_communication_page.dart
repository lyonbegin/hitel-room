import 'dart:async';
import 'dart:math';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'hitel_room.dart';

class HitelCommunicationPage extends StatefulWidget {
  const HitelCommunicationPage({super.key});
  @override
  State<HitelCommunicationPage> createState() => _HitelCommunicationPageState();
}
class _HitelCommunicationPageState extends State<HitelCommunicationPage> {
  final _api = HitelPublicRoomApi();
  late final _session = HitelRoomSession(_api);
  final _id = TextEditingController(text: 'android-${Random.secure().nextInt(1 << 31)}');
  final _name = TextEditingController(text: 'HITEL Android');
  final _title = TextEditingController(text: 'HITEL 영상 대화방');
  List<Json> _rooms = [];
  bool _busy = false;
  bool _authenticated = false;
  int _capacity = 8;
  String _error = '';
  @override
  void initState() {
    super.initState();
    _session.addListener(_changed);
  }
  void _changed() { if (mounted) setState(() {}); }
  Future<void> _run(Future<void> Function() work) async {
    if (_busy) return;
    setState(() { _busy = true; _error = ''; });
    try { await work(); }
    catch (e) { if (mounted) setState(() { _error = '$e'; _authenticated = false; }); }
    finally { if (mounted) setState(() => _busy = false); }
  }
  Future<void> _refresh() async {
    if (!_authenticated) {
      await _api.authenticate(_id.text.trim(), _name.text.trim());
      _authenticated = true;
    }
    final rooms = await _api.rooms();
    if (mounted) setState(() => _rooms = rooms);
  }
  @override
  void dispose() {
    _session.removeListener(_changed);
    unawaited(_session.shutdown());
    _id.dispose(); _name.dispose(); _title.dispose();
    super.dispose();
  }
  Widget _video(RTCVideoRenderer renderer, String title, {bool mirror = false}) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [Text(title), AspectRatio(aspectRatio: 4 / 3,
      child: ColoredBox(color: Colors.black, child: RTCVideoView(renderer, mirror: mirror)))],
  );
  @override
  Widget build(BuildContext context) {
    final id = _session.roomId;
    final joined = id != null;
    final own = _rooms.any((r) => r['id'] == id && (r['hostUserIds'] as List? ?? []).contains(_id.text.trim()));
    return Scaffold(
      appBar: AppBar(title: const Text('HITEL 통신 · 공개방')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const Text('기존 iOS 공개방 프로토콜 · Native WebRTC'),
        const Text('Fly.io SFU 어댑터와는 별도 연결 경로입니다.'),
        if (_busy) const LinearProgressIndicator(),
        Text(_session.status),
        if (_error.isNotEmpty) Text(_error, style: const TextStyle(color: Colors.red)),
        if (!joined) ...[
          TextField(controller: _id, decoration: const InputDecoration(labelText: '사용자 ID'), onChanged: (_) => _authenticated = false),
          TextField(controller: _name, decoration: const InputDecoration(labelText: '표시 이름'), onChanged: (_) => _authenticated = false),
          FilledButton(onPressed: _busy ? null : () => _run(_refresh), child: const Text('인증 및 공개방 조회')),
          TextField(controller: _title, decoration: const InputDecoration(labelText: '새 방 이름')),
          DropdownButton<int>(value: _capacity, items: [2, 4, 8, 16, 32].map((n) => DropdownMenuItem(value: n, child: Text('정원 $n명'))).toList(),
            onChanged: (n) => setState(() => _capacity = n ?? 8)),
          FilledButton(onPressed: _busy ? null : () => _run(() async {
            await _refresh();
            final room = await _api.create(_title.text, _capacity);
            await _refresh();
            await _session.start(room['id'] as String);
          }), child: const Text('공개방 생성 및 입장')),
          for (final room in _rooms)
            ListTile(title: Text('${room['title'] ?? room['id']}'), subtitle: Text('${room['status']}'),
              trailing: TextButton(onPressed: _busy ? null : () => _run(() => _session.start(room['id'] as String)), child: const Text('입장'))),
        ] else ...[
          Text('방 ID: $id · 영상 수신 확인 ${_session.renderedPeers}명'),
          if (_session.welcomed && !_session.changingVideo) _video(_session.local, _session.videoMode == 'mask' ? 'ARCore 가면' : '내 카메라', mirror: true),
          for (final entry in _session.remoteRenderers.entries) _video(entry.value, '상대 참가자 ${entry.key}'),
          Wrap(spacing: 8, children: [
            OutlinedButton(onPressed: _busy ? null : _session.toggleMic, child: Text(_session.mic ? '마이크 끄기' : '마이크 켜기')),
            OutlinedButton(onPressed: _busy ? null : _session.toggleCamera, child: Text(_session.camera ? '카메라 끄기' : '카메라 켜기')),
            if (_session.videoMode == 'camera') OutlinedButton(onPressed: _busy ? null : () => _run(_session.switchCamera), child: const Text('카메라 전환')),
            if (Platform.isAndroid) OutlinedButton(onPressed: _busy ? null : () => _run(() => _session.selectVideoMode(_session.videoMode == 'camera' ? 'mask' : 'camera')), child: Text(_session.videoMode == 'camera' ? 'ARCore 3D 가면' : '일반 영상')),
            FilledButton(onPressed: _busy ? null : () => _run(() async { await _session.leave(); await _refresh(); }), child: const Text('퇴장')),
            if (own) FilledButton(onPressed: _busy ? null : () => _run(() async { await _api.end(id); await _session.leave(); await _refresh(); }), child: const Text('방 종료')),
          ]),
        ],
      ]),
    );
  }
}
