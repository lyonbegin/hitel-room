import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class HitelRoute {
  const HitelRoute(this.id,this.from,this.to);
  final int id;
  final String from,to;
  bool get needsGateway => from.startsWith('P')||to.startsWith('P');
  static const kinds=['P','P+','N','W'];
  static List<HitelRoute> get all => [for(int i=0;i<4;i++) for(int j=0;j<4;j++) HitelRoute(i*4+j+1,kinds[i],kinds[j])];
}
class HitelCounselor {
  final http.Client _http=http.Client();
  String sessionId=_id();
  static String _id()=>List.generate(24,(_)=>Random.secure().nextInt(16).toRadixString(16)).join();
  static const endpoint='https://ai-counselor-sdk-production.up.railway.app';
  static const presets=<String,Map<String,dynamic>>{
    'generic':{'domain':'general','name':'AI 상담사','role':'범용 인공지능 상담사','objective':'요구를 파악하고 적절한 안내를 제공한다.','instructions':['확인하지 못한 사실을 만들어내지 않는다.'],'tools':[]},
    'beauty':{'domain':'beauty-dermatology','name':'AI언니','role':'피부·미용 상담사','objective':'피부·미용 상담 요구를 구조화하고 다음 행동을 안내한다.','instructions':['의학적 진단을 확정하지 않는다.'],'tools':['procedures','clinics','booking']},
    'elderly-care':{'domain':'elderly-care','name':'돌봄 상담사','role':'장기요양·통합돌봄 상담사','objective':'어르신과 보호자에게 필요한 돌봄을 파악한다.','instructions':['급여·기관 정보는 실제 제공 자료를 바탕으로 안내한다.'],'tools':['long-term-care','care-centers','welfare-equipment']},
    'tutoring':{'domain':'education','name':'AI 튜터','role':'개인 과외 상담사','objective':'학습자의 이해와 목표에 맞춰 설명한다.','instructions':['한 번에 한 개념씩 설명하고 이해도를 확인한다.'],'tools':['curriculum','problems']},
    'interview':{'domain':'career-interview','name':'AI 면접관','role':'모의면접 상담사','objective':'모의면접과 구체적 피드백을 제공한다.','instructions':['질문은 한 번에 하나씩 한다.'],'tools':['jobs','resume','interview-rubric']},
  };
  Map<String,dynamic> profile(String preset)=>{'preset':preset,'id':preset,...presets[preset]!,
    'language':'ko','voice':'coral','knowledge':[],
    'policy':{'maxReplySentences':5,'askBeforeAssuming':true,'humanHandoffWhenUncertain':true}};
  Future<Map<String,dynamic>> _post(String path,String userToken,Map<String,dynamic> body) async {
    if(userToken.trim().isEmpty)throw StateError('서버 발급 사용자 세션 인증 필요 (관리자 키 금지)');
    final response=await _http.post(Uri.parse(endpoint+path),headers:{
      'Authorization':'Bearer ${userToken.trim()}','Content-Type':'application/json'},body:jsonEncode(body)).timeout(const Duration(seconds:25));
    if(response.statusCode<200||response.statusCode>=300)throw StateError('AI Counselor HTTP ${response.statusCode}');
    return Map<String,dynamic>.from(jsonDecode(response.body) as Map);
  }
  Future<Map<String,dynamic>> respond(String token,String preset,String text) {
    if(text.trim().isEmpty)throw ArgumentError('메시지를 입력하십시오');
    return _post('/v1/respond',token,{'sessionId':sessionId,'profile':profile(preset),'text':text.trim(),'context':{}});
  }
  Future<void> reset(String token)async{await _post('/v1/session/reset',token,{'sessionId':sessionId});sessionId=_id();}
  void close()=>_http.close();
}
class HitelCounselorPage extends StatefulWidget {
  const HitelCounselorPage({super.key});
  @override State<HitelCounselorPage> createState()=>_HitelCounselorPageState();
}
class _HitelCounselorPageState extends State<HitelCounselorPage>{
  final _api=HitelCounselor();
  final _credential=TextEditingController(), _text=TextEditingController();
  String _preset='generic',_output='';bool _busy=false;
  Future<void> _send(bool reset) async{
    if(_busy)return;
    setState(()=>_busy=true);
    try{
      if(reset){await _api.reset(_credential.text);if(mounted)setState(()=>_output='세션 초기화');}
      else{final r=await _api.respond(_credential.text,_preset,_text.text);if(mounted)setState(()=>_output=const JsonEncoder.withIndent('  ').convert(r));}
    }catch(e){if(mounted)setState(()=>_output='$e');}
    finally{if(mounted)setState(()=>_busy=false);}
  }
  @override void dispose(){_api.close();_credential.dispose();_text.dispose();super.dispose();}
  @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('AI Counselor')),
    body:ListView(padding:const EdgeInsets.all(16),children:[
      const Text('기존 AI Counselor REST 계약. 실사용 인증은 서버 발급 사용자 단위 토큰만 허용합니다.'),
      TextField(controller:_credential,obscureText:true,enableSuggestions:false,autocorrect:false,decoration:const InputDecoration(labelText:'사용자 세션 토큰')),
      DropdownButton<String>(value:_preset,items:HitelCounselor.presets.entries.map((p)=>DropdownMenuItem(value:p.key,child:Text(p.value['name'] as String))).toList(),onChanged:(p)=>setState(()=>_preset=p??'generic')),
      TextField(controller:_text,decoration:const InputDecoration(labelText:'상담 메시지')),
      FilledButton(onPressed:_busy?null:()=>_send(false),child:const Text('AI 응답 요청')),
      OutlinedButton(onPressed:_busy?null:()=>_send(true),child:const Text('상담 초기화')),
      if(_busy)const LinearProgressIndicator(),
      SelectableText(_output),
    ]));
}
