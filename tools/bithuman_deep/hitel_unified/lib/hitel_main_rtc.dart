import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

/// The main screen uses only this receive renderer. The source stream belongs to
/// the on-device host; no sender-side texture is ever attached to the screen.
class HitelRtcPlayback extends ChangeNotifier {
  final renderer = RTCVideoRenderer();
  bool initialized = false, connected = false, firstFrame = false;
  bool _disposed = false;
  String status = 'WebRTC 연결 대기';
  String evidence = 'RTP 미수신';
  Future<void>? _init;
  Future<void> initialize() => _init ??= _initialize();
  Future<void> _initialize() async {
    await renderer.initialize();
    initialized = true;
    renderer.onFirstFrameRendered = () {
      if (_disposed || !connected) return;
      firstFrame = true;
      status = 'WebRTC 수신 영상 표시';
      _notify();
    };
  }
  void _notify() { if (!_disposed) notifyListeners(); }
  void attachRemote(MediaStream stream) {
    if (_disposed || !initialized) return;
    renderer.srcObject = stream;
  }
  void update(String message, {required bool online}) {
    if (_disposed) return;
    connected = online;
    status = message;
    if (!online) {
      firstFrame = false;
      if (initialized) renderer.srcObject = null;
    }
    _notify();
  }
  void record(String value) { evidence = value; _notify(); }
  Widget view() => initialized && connected
      ? RTCVideoView(renderer, mirror: false,
          objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain)
      : const ColoredBox(color: Colors.black);
  Future<void> shutdown() async {
    if (_disposed) return;
    _disposed = true;
    try { await _init; } catch (_) {}
    if (initialized) { renderer.srcObject = null; await renderer.dispose(); }
    super.dispose();
  }
}

/// One on-device avatar publisher, one real receiver. Local SDP/ICE interchange
/// is in-process, no external STUN/TURN or network service. The native source
/// supplies video and PCM, never the platform avatar renderer.
class HitelLocalRtcHost {
  HitelLocalRtcHost(this.playback, this.trace);
  final HitelRtcPlayback playback;
  final void Function(String) trace;
  RTCPeerConnection? _tx, _rx;
  MediaStream? _source, _received;
  Timer? _stats;
  bool _closed = false, _sampling = false;
  int _epoch = 0;
  Future<void>? _starting, _stopping;
  bool get ready => !_closed && playback.connected && _tx != null && _rx != null;
  MediaStream? get outboundStream => ready ? _source : null;

  Future<void> start(int width, int height) async {
    if (_closed) throw StateError('RTC host disposed');
    await _stopping;
    if (ready) return;
    if (_starting != null) return _starting!;
    final f = _start(width,height);
    _starting = f;
    try { await f; } finally { if (identical(_starting,f)) _starting=null; }
  }
  Future<void> _start(int width,int height) async {
    final epoch = ++_epoch;
    bool valid() => !_closed && epoch == _epoch;
    void guard() { if (!valid()) throw StateError('RTC start cancelled'); }
    playback.update('WebRTC 로컬 송신/수신 연결 중', online:false);
    trace('RTC_HOST_START width=$width height=$height no_external_ice=true');
    final readySignal = Completer<void>();
    // Complete with a value on failure to avoid an unhandled early ICE error.
    bool iceReady = false;
    try {
      await playback.initialize(); guard();
      final tx = await createPeerConnection({'sdpSemantics':'unified-plan','iceServers':[]});
      if (!valid()) { await tx.close(); await tx.dispose(); guard(); }
      _tx=tx;
      final rx = await createPeerConnection({'sdpSemantics':'unified-plan','iceServers':[]});
      if (!valid()) { await rx.close(); await rx.dispose(); guard(); }
      _rx=rx;
      final toRx=<RTCIceCandidate>[], toTx=<RTCIceCandidate>[];
      bool rxRemote=false,txRemote=false;
      tx.onIceCandidate=(c) {
        if(!valid()||c.candidate==null||c.candidate!.isEmpty)return;
        if(rxRemote){unawaited(rx.addCandidate(c).catchError((Object e){trace('RTC_ICE_ERROR $e');}));}
        else{toRx.add(c);}
      };
      rx.onIceCandidate=(c) {
        if(!valid()||c.candidate==null||c.candidate!.isEmpty)return;
        if(txRemote){unawaited(tx.addCandidate(c).catchError((Object e){trace('RTC_ICE_ERROR $e');}));}
        else{toTx.add(c);}
      };
      rx.onTrack=(e) {
        if(!valid())return;
        trace('RTC_REMOTE_TRACK kind=${e.track.kind} id=${e.track.id}');
        if(e.track.kind=='video'&&e.streams.isNotEmpty){
          _received=e.streams.first;
          if(playback.connected) playback.attachRemote(_received!);
        }
      };
      rx.onIceConnectionState=(state) {
        if(!valid())return;
        trace('RTC_RX_ICE ${state.name}');
        iceReady=state==RTCIceConnectionState.RTCIceConnectionStateConnected||
          state==RTCIceConnectionState.RTCIceConnectionStateCompleted;
        if(iceReady){
          playback.update('WebRTC 연결 · 수신 대기',online:true);
          if(_received!=null)playback.attachRemote(_received!);
          if(!readySignal.isCompleted)readySignal.complete();
        }else if(state==RTCIceConnectionState.RTCIceConnectionStateFailed||
                 state==RTCIceConnectionState.RTCIceConnectionStateDisconnected||
                 state==RTCIceConnectionState.RTCIceConnectionStateClosed){
          playback.update('WebRTC 연결 중단 · 직접 재생 금지',online:false);
          if(!readySignal.isCompleted)readySignal.complete();
          unawaited(stop());
        }
      };
      final source=await navigator.mediaDevices.getUserMedia({
        'audio': {'echoCancellation':false,'noiseSuppression':false,'autoGainControl':false},
        'video':{'facingMode':'user','width':width,'height':height,'frameRate':25,'hitelMode':'avatar'}
      });
      if(!valid()){
        for(final t in source.getTracks()){await t.stop();}
        await source.dispose();guard();
      }
      _source=source;
      if(source.getVideoTracks().length!=1||source.getAudioTracks().length!=1)throw StateError('RTC avatar A/V tracks missing');
      for(final track in source.getTracks()){await tx.addTrack(track,source);guard();}
      final offer=await tx.createOffer();
      await tx.setLocalDescription(offer);guard();
      await rx.setRemoteDescription(offer);guard();
      rxRemote=true;for(final c in toRx.toList()){await rx.addCandidate(c);}toRx.clear();
      final answer=await rx.createAnswer();
      await rx.setLocalDescription(answer);guard();
      await tx.setRemoteDescription(answer);guard();
      txRemote=true;for(final c in toTx.toList()){await tx.addCandidate(c);}toTx.clear();
      await readySignal.future.timeout(const Duration(seconds:20));guard();
      if(!iceReady||!playback.connected)throw StateError('RTC ICE not connected');
      await Helper.setSpeakerphoneOn(true);guard();
      trace('RTC_HOST_READY audioSource=external_pcm videoSource=essence2 nativeFallback=false');
      _stats=Timer.periodic(const Duration(seconds:1),(_)=>unawaited(_sample(epoch)));
      await _sample(epoch);
    }catch(e){
      trace('RTC_HOST_FAIL $e');
      if(valid()) await stop();
      rethrow;
    }
  }
  Future<void> _sample(int epoch)async{
    if(_sampling||_closed||epoch!=_epoch||!ready)return;
    _sampling=true;
    try{
      final tx=_tx,rx=_rx;
      if(tx==null||rx==null)return;
      final out=await tx.getStats(), input=await rx.getStats();
      String summarize(List<StatsReport> data,String type) {
        return data.where((r)=>r.type==type).map((r){
          final v=r.values;
          final kind=v['kind']??v['mediaType']??'?';
          final fields=['packetsSent','packetsReceived','bytesSent','bytesReceived','framesEncoded','framesDecoded','framesPerSecond','totalSamplesReceived','concealedSamples','totalAudioEnergy','jitter','packetsLost'];
          return '$kind ${fields.where(v.containsKey).map((k)=>'$k=${v[k]}').join(' ')}';
        }).join(' | ');
      }
      if(epoch!=_epoch||_closed)return;
      final message='RTC_RTP_TX ${summarize(out,'outbound-rtp')} ; RTC_RTP_RX ${summarize(input,'inbound-rtp')}';
      playback.record(message);
      trace(message);
    }catch(e){trace('RTC_STATS_ERROR $e');}
    finally{_sampling=false;}
  }
  Future<void> stop() {
    final prior=_stopping;if(prior!=null)return prior;
    final task=_stop();_stopping=task;
    return task.whenComplete((){if(identical(_stopping,task))_stopping=null;});
  }
  Future<void> _stop()async{
    ++_epoch;
    _stats?.cancel();_stats=null;
    playback.update('WebRTC 중단 · 직접 출력 없음',online:false);
    final tx=_tx,rx=_rx,source=_source;
    _tx=null;_rx=null;_source=null;_received=null;
    // Close both transport endpoints before releasing the global PCM override.
    if(tx!=null){await tx.close();await tx.dispose();}
    if(rx!=null){await rx.close();await rx.dispose();}
    if(source!=null){
      for(final track in source.getAudioTracks()){await track.stop();}
      for(final track in source.getVideoTracks()){await track.stop();}
      await source.dispose();
    }
    trace('RTC_HOST_STOPPED');
  }
  Future<void> shutdown()async{_closed=true;await stop();await playback.shutdown();}
}
