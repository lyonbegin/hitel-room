import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

/// A real local sender/receiver PeerConnection pair, independent of servers.
/// Currently camera/ARCore test inputs only; not a false avatar playback demo.
class HitelLoopbackPage extends StatefulWidget {
  const HitelLoopbackPage({super.key, this.avatarWidth, this.avatarHeight, this.onPlay, this.onCancel});
  final int? avatarWidth, avatarHeight;
  final VoidCallback? onPlay;
  final Future<void> Function()? onCancel;
  bool get avatarMode => onPlay != null;
  @override
  State<HitelLoopbackPage> createState() => _HitelLoopbackPageState();
}
class _HitelLoopbackPageState extends State<HitelLoopbackPage> {
  final _receiverView = RTCVideoRenderer();
  RTCPeerConnection? _tx, _rx;
  MediaStream? _local;
  Future<void>? _init;
  bool _busy = false, _frame = false, _audio = false, _mask = false, _closed = false, _connected = false;
  String _status = '연결 전';
  void _update(String s) { if (mounted) setState(() => _status = s); }
  @override void initState() {
    super.initState();
    _init = _receiverView.initialize();
    _receiverView.onFirstFrameRendered = () {
      if (mounted) setState(() { _frame = true; _status = 'WebRTC 수신 영상 첫 프레임 확인'; });
    };
  }
  Future<void> _start() async {
    if (_busy || _tx != null) return;
    setState(() { _busy = true; _frame = false; });
    try {
      await _init;
      if (_closed) return;
      final media = await navigator.mediaDevices.getUserMedia({
        'audio': widget.avatarMode || _audio,
        'video': {'facingMode':'user','width':widget.avatarWidth ?? 640,'height':widget.avatarHeight ?? 480,'frameRate':25,
          if (widget.avatarMode) 'hitelMode':'avatar' else if (_mask) 'hitelMode':'mask'},
      });
      _local = media;
      if (_closed) { await _stop(); return; }
      _tx = await createPeerConnection({'sdpSemantics':'unified-plan','iceServers':[]});
      _rx = await createPeerConnection({'sdpSemantics':'unified-plan','iceServers':[]});
      final tx = _tx!, rx = _rx!;
      final toTx = <RTCIceCandidate>[], toRx = <RTCIceCandidate>[];
      bool txRemote = false, rxRemote = false;
      tx.onIceCandidate = (c) {
        if (c.candidate == null) return;
        if (rxRemote) { unawaited(rx.addCandidate(c).catchError((Object e) => _update('ICE: $e'))); }
        else { toRx.add(c); }
      };
      rx.onIceCandidate = (c) {
        if (c.candidate == null) return;
        if (txRemote) { unawaited(tx.addCandidate(c).catchError((Object e) => _update('ICE: $e'))); }
        else { toTx.add(c); }
      };
      rx.onTrack = (e) {
        if (e.track.kind == 'video' && e.streams.isNotEmpty && !_closed) {
          _receiverView.srcObject = e.streams.first;
        }
      };
      rx.onIceConnectionState = (s) {
        _connected = s == RTCIceConnectionState.RTCIceConnectionStateConnected || s == RTCIceConnectionState.RTCIceConnectionStateCompleted;
        if (!_frame) _update('ICE: ${s.name} · 수신 프레임 대기');
      };
      for (final t in media.getTracks()) { await tx.addTrack(t,media); }
      final offer = await tx.createOffer();
      await tx.setLocalDescription(offer);
      await rx.setRemoteDescription(offer);
      rxRemote=true; for(final c in toRx) { await rx.addCandidate(c); } toRx.clear();
      final answer = await rx.createAnswer();
      await rx.setLocalDescription(answer);
      await tx.setRemoteDescription(answer);
      txRemote=true; for(final c in toTx) { await tx.addCandidate(c); } toTx.clear();
      _update('SDP 교환 완료 · 수신 영상 검증 대기');
    } catch(e) { await _stop(); _update('Loopback 실패: $e'); }
    finally { if(mounted) setState(() => _busy=false); }
  }
  Future<void> _stop() async {
    _connected=false;
    await widget.onCancel?.call();
    final tx=_tx,rx=_rx,local=_local;
    _tx=null;_rx=null;_local=null;
    _receiverView.srcObject=null;
    if(tx!=null){await tx.close();await tx.dispose();}
    if(rx!=null){await rx.close();await rx.dispose();}
    if(local!=null){for(final t in local.getTracks()){await t.stop();}await local.dispose();}
    if(mounted)setState((){_frame=false;});
  }
  @override void dispose() {
    _closed=true;
    unawaited(() async { await _init; await _stop(); await _receiverView.dispose(); }());
    super.dispose();
  }
  @override Widget build(BuildContext context) => Scaffold(
    appBar:AppBar(title:Text(widget.avatarMode?'Essence2 WebRTC 재생 (시험)':'WebRTC 내부 재생 검증')),
    body:ListView(padding:const EdgeInsets.all(16),children:[
      Text(widget.avatarMode?'GPU 아바타와 대응 PCM을 같은 WebRTC 연결로 재생하는 시험 경로.':'서버 없이 동일 단말에서 실제 RTP 송수신.'),
      const Text('음성 테스트는 이어폰을 사용하십시오.'),
      if(!widget.avatarMode) SwitchListTile(title:const Text('마이크 음성 포함'), value:_audio,onChanged:_busy||_tx!=null?null:(v)=>setState(()=>_audio=v)),
      if(Platform.isAndroid&&!widget.avatarMode) SwitchListTile(title:const Text('ARCore 가면 입력'),value:_mask,onChanged:_busy||_tx!=null?null:(v)=>setState(()=>_mask=v)),
      AspectRatio(aspectRatio:4/3,child:ColoredBox(color:Colors.black,child:RTCVideoView(_receiverView))),
      Text(_status),
      if(_busy)const LinearProgressIndicator(),
      FilledButton(onPressed:_busy||_tx!=null?null:_start,child:const Text('WebRTC 송수신 시작')),
      if(widget.avatarMode) FilledButton(onPressed:_connected&&!_busy?widget.onPlay:null,child:const Text('아바타 시험 음성 재생')),
      OutlinedButton(onPressed:_busy||_tx==null?null:()async{await _stop();_update('연결 종료');},child:const Text('종료')),
    ]),
  );
}
