import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:http/http.dart' as http;
import 'hitel_room.dart';

class HitelDeviceCall extends ChangeNotifier {
  static const base='https://hitel-communication-web-production.up.railway.app/lab-sandbox/playground';
  static const _store=FlutterSecureStorage();
  final local=RTCVideoRenderer(), remote=RTCVideoRenderer();
  final _http=http.Client();
  WebSocket? _device, _call;
  StreamSubscription<dynamic>? _deviceSub,_callSub;
  Timer? _retry, _callRetry;
  RTCPeerConnection? _pc;
  MediaStream? _media;
  final _pending=<RTCIceCandidate>[];
  bool _remoteSet=false,_closed=false,_initialized=false,_registering=false,_connecting=false;
  Future<void> _serial=Future.value();
  String _deviceId='',_deviceKey='',_sessionId='',_sessionKey='';
  String url='',status='고유 주소 준비',side='',route='',kind='',phase='idle';
  bool connected=false,videoReceived=false,mic=true,camera=true;
  int _sequence=0;
  void _changed(){if(!_closed)notifyListeners();}
  void _status(String text){status=text;_changed();}
  static String _random(int n)=>List.generate(n,(_)=>Random.secure().nextInt(16).toRadixString(16)).join();
  static Json _json(dynamic raw)=>Json.from(jsonDecode(raw is String?raw:utf8.decode(raw as List<int>)) as Map);
  Future<void> start() async {
    await local.initialize();await remote.initialize();_initialized=true;
    if(_closed)return;
    remote.onFirstFrameRendered=(){videoReceived=true;_status('상대 WebRTC 영상 수신 확인');};
    // Persist identity as one encrypted record; never store or log call keys in plaintext.
    final stored=await _store.read(key:'hitel.device.identity.v1');
    if(stored!=null){
      final identity=_json(stored);_deviceId=identity['id'] as String;_deviceKey=identity['key'] as String;
    }else{
      _deviceId=_random(32);_deviceKey=_random(64);
      await _store.write(key:'hitel.device.identity.v1',value:jsonEncode({'id':_deviceId,'key':_deviceKey}));
    }
    await _register();
  }
  Future<void> _register()async{
    if(_closed||_registering||_device!=null)return;
    _registering=true;
    try{
      final r=await _http.post(Uri.parse('$base/device/register'),
        headers:{'Content-Type':'application/json'},body:jsonEncode({'id':_deviceId,'key':_deviceKey})).timeout(const Duration(seconds:15));
      if(r.statusCode!=200)throw StateError('기기 등록 HTTP ${r.statusCode}');
      final result=_json(r.body);
      final page=result['pageUrl'];if(page is! String||page.isEmpty)throw StateError('pageUrl missing');
      if(_closed)return;
      url=page;_status('고유 웹 주소 등록 · 인증 대기');
      final ws=await WebSocket.connect('${base.replaceFirst('https:','wss:')}/device/socket').timeout(const Duration(seconds:12));
      if(_closed){await ws.close();return;}
      _device=ws;ws.pingInterval=const Duration(seconds:20);
      _deviceSub=ws.listen((raw){
        if(_device!=ws||_closed)return;
        try{
          final msg=_json(raw);
          if(msg['type']=='device.ready')_status('기기 온라인 · 웹에서 배정 대기');
          if(msg['type']=='device.assign'){
            _serial=_serial.then((_)=>_assign(msg)).catchError((Object e,StackTrace s)=>_status('배정 실패: $e'));
          }
        }catch(e){_status('기기 신호 오류: $e');}
      },onError:(Object _)=>_deviceLost(ws),onDone:()=>_deviceLost(ws));
      ws.add(jsonEncode({'type':'device.auth','id':_deviceId,'key':_deviceKey}));
    }catch(e){_status('기기 등록 오류: $e');_scheduleDevice();}
    finally{_registering=false;}
  }
  void _deviceLost(WebSocket ws){
    if(_device!=ws)return;_device=null;_deviceSub=null;
    if(!_closed){_status('기기 연결 끊김 · 재접속');_scheduleDevice();}
  }
  void _scheduleDevice(){if(!_closed){_retry?.cancel();_retry=Timer(const Duration(seconds:4),()=>unawaited(_register()));}}
  Future<void> _assign(Json msg)async{
    if(_closed)return;
    final id=msg['id'],secret=msg['secret'],role=msg['side'],data=msg['route'];
    if(id is! String||secret is! String||!['A','B'].contains(role)||data is! Map)throw StateError('배정 형식 오류');
    if(id==_sessionId&&role==side&&connected)return;
    await _closeCall();
    _sessionId=id;_sessionKey=secret;side=role as String;
    route='${data['from']} → ${data['to']} (SC-${data['id']})';
    kind=(side=='A'?data['from']:data['to']) as String;
    phase=(msg['phase']??'idle').toString();_sequence=0;
    await _openCall();
  }
  Future<void> _openCall()async{
    if(_closed||_sessionId.isEmpty||_connecting||_call!=null)return;
    _connecting=true;
    final expected=_sessionId;
    try{
      final uri=Uri.parse('${base.replaceFirst('https:','wss:')}/socket').replace(queryParameters:{
        'id':_sessionId,'side':side,'secret':_sessionKey});
      final ws=await WebSocket.connect(uri.toString()).timeout(const Duration(seconds:12));
      if(_closed||expected!=_sessionId){await ws.close();return;}
      _call=ws;ws.pingInterval=const Duration(seconds:20);
      _callSub=ws.listen((raw){
        _serial=_serial.then((_)async{
          if(_call==ws&&!_closed)await _handle(_json(raw));
        }).catchError((Object e,StackTrace s)=>_status('통화 처리 오류: $e'));
      },onError:(Object _)=>_callLost(ws),onDone:()=>_callLost(ws));
    }catch(_){_status('통화 연결 실패 · 다시 연결');_scheduleCall();}
    finally{_connecting=false;}
  }
  void _callLost(WebSocket ws){if(_call!=ws)return;_call=null;_callSub=null;connected=false;if(!_closed){_status('통화 시그널링 재연결');_scheduleCall();}}
  void _scheduleCall(){if(!_closed){_callRetry?.cancel();_callRetry=Timer(const Duration(milliseconds:2500),()=>unawaited(_openCall()));}}
  void send(String type,[Json? payload]){
    if(!connected||_call==null){_status('서버 HELLO 대기');return;}
    _call!.add(jsonEncode({'type':type,'requestId':_random(32),if(payload!=null)'payload':payload}));
    _status('전송: $type');
  }
  Future<void> _handle(Json msg)async{
    final type=msg['type'];
    if(type=='hello'){
      connected=true;if(msg['state'] is Map)phase=(msg['state']['phase']??phase).toString();
      _status('통화 서버 HELLO · $route');return;
    }
    if(type=='event'&&msg['event'] is Map){
      final e=Json.from(msg['event'] as Map);final seq=e['seq'] as num? ?? 0;
      if(seq<=_sequence)return;_sequence=seq.toInt();
      switch(e['type']){
        case 'call.ringing':phase='ringing';_status('통화 요청');break;
        case 'call.accept':
          phase='accepted';_status('통화 수락');
          if(side=='A'&&(kind=='N'||kind=='W')){
            await _mediaStart();final offer=await _pc!.createOffer();
            await _pc!.setLocalDescription(offer);send('rtc.offer',{'type':'offer','sdp':offer.sdp});
          }
          break;
        case 'call.reject':phase='rejected';await _mediaStop();_changed();break;
        case 'call.end':
        case 'call.cancel':phase='ended';await _mediaStop();_changed();break;
        case 'rtc.answer':phase='media';_changed();break;
      }
    }else if(type=='rtc.offer'&&msg['payload'] is Map){
      if(kind!='N'&&kind!='W'){_status('일반전화에는 별도 게이트웨이가 필요합니다');return;}
      await _mediaStart();await _setRemote(msg['payload']);
      final answer=await _pc!.createAnswer();await _pc!.setLocalDescription(answer);
      send('rtc.answer',{'type':'answer','sdp':answer.sdp});
    }else if(type=='rtc.answer'&&msg['payload'] is Map){
      if(_pc!=null)await _setRemote(msg['payload']);
    }else if(type=='rtc.ice'&&msg['payload'] is Map){
      final x=msg['payload'];if(x['candidate'] is! String)return;
      final c=RTCIceCandidate(x['candidate'] as String,x['sdpMid'] as String?,(x['sdpMLineIndex'] as num?)?.toInt());
      if(_pc!=null&&_remoteSet)await _pc!.addCandidate(c);else _pending.add(c);
    }else if(type=='ack'&&msg['ok']==false){_status('서버 명령 거절: ${msg['reason']??''}');}
  }
  Future<void> _setRemote(dynamic value)async{
    await _pc!.setRemoteDescription(RTCSessionDescription(value['sdp'] as String,value['type'] as String));
    _remoteSet=true;for(final c in _pending){await _pc!.addCandidate(c);}_pending.clear();
  }
  Future<void> _mediaStart()async{
    if(_pc!=null)return;
    try{
      _media=await navigator.mediaDevices.getUserMedia({'audio':true,'video':{'facingMode':'user','width':640,'height':480,'frameRate':25}});
      if(_closed){await _mediaStop();return;}
      _pc=await createPeerConnection({'sdpSemantics':'unified-plan','iceServers':[{'urls':'stun:stun.l.google.com:19302'}]});
      final pc=_pc!;
      local.srcObject=_media;
      pc.onTrack=(e){if(e.track.kind=='video'&&e.streams.isNotEmpty&&!_closed)remote.srcObject=e.streams.first;};
      pc.onIceCandidate=(c){if(c.candidate!=null)send('rtc.ice',{'candidate':c.candidate,'sdpMid':c.sdpMid,'sdpMLineIndex':c.sdpMLineIndex});};
      pc.onIceConnectionState=(s)=>_status('통화 ICE: ${s.name} · 실제 영상 수신 여부 $videoReceived');
      for(final t in _media!.getTracks()){await pc.addTrack(t,_media!);}
    }catch(_){await _mediaStop();rethrow;}
  }
  void toggleMic(){mic=!mic;for(final t in _media?.getAudioTracks()??<MediaStreamTrack>[]){t.enabled=mic;}_changed();}
  void toggleCamera(){camera=!camera;for(final t in _media?.getVideoTracks()??<MediaStreamTrack>[]){t.enabled=camera;}_changed();}
  Future<void> _mediaStop()async{
    final pc=_pc,media=_media;_pc=null;_media=null;_remoteSet=false;_pending.clear();videoReceived=false;
    if(_initialized){local.srcObject=null;remote.srcObject=null;}
    if(pc!=null){await pc.close();await pc.dispose();}
    if(media!=null){for(final t in media.getTracks()){await t.stop();}await media.dispose();}
    mic=true;camera=true;
  }
  Future<void> _closeCall()async{
    _callRetry?.cancel();connected=false;
    final ws=_call,sub=_callSub;_call=null;_callSub=null;
    await sub?.cancel();await ws?.close();await _mediaStop();
  }
  Future<void> shutdown()async{
    _closed=true;_retry?.cancel();_callRetry?.cancel();
    final ws=_device;_device=null;await _deviceSub?.cancel();await ws?.close();
    await _closeCall();_http.close();
    if(_initialized){await local.dispose();await remote.dispose();}
    super.dispose();
  }
}

class HitelDeviceCallPage extends StatefulWidget{
  const HitelDeviceCallPage({super.key});
  @override State<HitelDeviceCallPage> createState()=>_HitelDeviceCallPageState();
}
class _HitelDeviceCallPageState extends State<HitelDeviceCallPage>{
  final _call=HitelDeviceCall();
  void _update(){if(mounted)setState((){});}
  @override void initState(){
    super.initState();_call.addListener(_update);
    unawaited(_call.start().catchError((Object e)=>_call._status('초기화 오류: $e')));
  }
  @override void dispose(){_call.removeListener(_update);unawaited(_call.shutdown());super.dispose();}
  Widget _video(RTCVideoRenderer r)=>AspectRatio(aspectRatio:4/3,child:ColoredBox(color:Colors.black,child:RTCVideoView(r)));
  @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('기기 고유 주소 · 1:1 통화')),
    body:ListView(padding:const EdgeInsets.all(16),children:[
      Text(_call.status),
      if(_call.url.isNotEmpty)...[
        const Text('고유 웹 관리 주소 (PIN 불필요)'),
        SelectableText(_call.url),
        TextButton(onPressed:()=>Clipboard.setData(ClipboardData(text:_call.url)),child:const Text('주소 복사')),
      ],
      Text('${_call.route} · ${_call.side} · ${_call.phase}'),
      if(_call.kind.startsWith('P'))const Text('일반전화 음성 수집·주입은 지원하지 않습니다.'),
      if(_call.kind=='N'||_call.kind=='W')...[_video(_call.local),_video(_call.remote)],
      Wrap(spacing:8,children:[
        FilledButton(onPressed:_call.connected?()=>_call.send('call.invite'):null,child:const Text('통화 요청')),
        FilledButton(onPressed:_call.connected?()=>_call.send('call.accept'):null,child:const Text('수락')),
        OutlinedButton(onPressed:_call.connected?()=>_call.send('call.reject'):null,child:const Text('거절')),
        OutlinedButton(onPressed:_call.connected?()=>_call.send('call.end'):null,child:const Text('종료')),
        OutlinedButton(onPressed:_call.toggleMic,child:Text(_call.mic?'마이크 끄기':'마이크 켜기')),
        OutlinedButton(onPressed:_call.toggleCamera,child:Text(_call.camera?'카메라 끄기':'카메라 켜기')),
      ]),
      const Text('Android Telecom 및 백그라운드 수신 연동은 아직 미구현입니다.'),
    ]));
}
