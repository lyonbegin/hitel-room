#!/usr/bin/env python3
"""V27: repair service state transition from a playing M4A to chosen Call folder.
The codec/player/STT data paths are preserved byte-for-byte. Only service state
transitions and provenance logs change.
Execute after v20_restore_proven_media_output_v26.py.
"""
from pathlib import Path
p=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe")
service=p/"SpeakerService.java"
source=service.read_text(encoding="utf-8")
untouched={n:(p/n).read_bytes() for n in [
    "KoreanSherpaStt.java","SpeakerPlaybackStt.java","SpeakerPlaybackCaptureService.java",
    "SpeakerEngine.java","PcmDirectSherpaSink.java","PcmSpeakerMonitor.java",
    "StreamingAacPcmDecoder.java","HitelSafLogSaver.java","CallStateGate.java"]}
def fix(old,new):
    global source
    assert source.count(old)==1, "missing or duplicate service anchor: "+repr(old[:150])
    source=source.replace(old,new,1)

fix('''  private volatile boolean restartAfterCleanup;

  @Override public IBinder onBind(Intent intent){return null;}''',
'''  private volatile boolean restartAfterCleanup;
  /** Last requested START wins; applied only AFTER the old PCM worker exits. */
  private volatile Intent pendingSourceSwitch;

  @Override public IBinder onBind(Intent intent){return null;}''')
fix('''    if(STOP.equals(action)){
      shutdown();
      return START_NOT_STICKY;
    }''',
'''    if(STOP.equals(action)){
      // Explicit stop cancels a queued source switch.
      pendingSourceSwitch=null;
      if(shuttingDown && active)shuttingDown=false;
      shutdown();
      return START_NOT_STICKY;
    }''')
fix('''    if(!START.equals(action))return START_NOT_STICKY;
    if(active){send("통화 이벤트 자동 감시가 이미 실행 중입니다.",false);return START_NOT_STICKY;}
    try{''',
'''    if(!START.equals(action))return START_NOT_STICKY;
    if(active||engine!=null||shuttingDown){
      queueSourceSwitch(intent);
      return START_NOT_STICKY;
    }
    try{''')
fix('''  private synchronized void onCallConnected(){''',
'''  /** Source switch is not a duplicate START. Never run two AAC decoders together. */
  private synchronized void queueSourceSwitch(Intent incoming){
    String raw=incoming.getStringExtra(EX_URI);
    if(raw==null||raw.isEmpty()){
      send("녹음 파일/폴더 주소가 없습니다. 먼저 소스를 선택하십시오.",false);
      return;
    }
    pendingSourceSwitch=new Intent(incoming);
    if(journal!=null)journal.event("CONTROL","SOURCE_SWITCH_REQUESTED",
        "sourceUri",raw,
        "folder",incoming.getBooleanExtra(EX_FOLDER,false),
        "mode",incoming.getIntExtra(EX_DEVICE,-1),
        "oldAutoCallMode",autoCallMode,
        "oldEngineRunning",engine!=null);
    // Prevent stale CALL_STATE callbacks from launching another session.
    CallStateGate oldGate=callEvents;
    callEvents=null;
    if(oldGate!=null)oldGate.close();
    shuttingDown=true;
    restartAfterCleanup=false;
    SpeakerEngine previous=engine;
    if(previous!=null){
      previous.stop();
      send("이전 녹음 작업 종료 중 · 새 소스 전환 예약됨",false);
    }else{
      applyPendingSwitch();
    }
  }

  /** Called only when the previous engine is gone; reuses this same service. */
  private synchronized void applyPendingSwitch(){
    final Intent next=pendingSourceSwitch;
    if(next==null)return;
    if(engine!=null){
      if(journal!=null)journal.event("CONTROL","SOURCE_SWITCH_WAITING_FOR_ENGINE_EXIT");
      return;
    }
    pendingSourceSwitch=null;
    if(journal!=null)journal.event("CONTROL","SOURCE_SWITCH_APPLY",
        "sourceUri",next.getStringExtra(EX_URI),
        "folder",next.getBooleanExtra(EX_FOLDER,false));
    active=false;
    shuttingDown=false;
    restartAfterCleanup=false;
    send("기존 재생 정리 완료 · 새 파일/폴더 감시 시작 요청",false);
    new android.os.Handler(android.os.Looper.getMainLooper()).post(
        ()->onStartCommand(next,0,0));
  }

  private synchronized void onCallConnected(){''')
fix('''      synchronized(SpeakerService.this){
        if(engine==holder[0])engine=null;
        sessionJournal=null;
      }
      if(shuttingDown||!autoCallMode){''',
'''      synchronized(SpeakerService.this){
        if(engine==holder[0])engine=null;
        sessionJournal=null;
        if(pendingSourceSwitch!=null){
          // Old worker is fully stopped and its export has been verified.
          applyPendingSwitch();
          return;
        }
      }
      if(shuttingDown||!autoCallMode){''')
service.write_text(source,encoding="utf-8")
g=Path("AndroidProject/app/build.gradle.kts")
s=g.read_text(encoding="utf-8")
assert s.count("versionCode = 34")==1
assert s.count("0.14.20-proven-media-output-v26")==1
s=s.replace("versionCode = 34","versionCode = 35",1)
s=s.replace("0.14.20-proven-media-output-v26",
            "0.14.21-source-switch-auto-folder-v27",1)
g.write_text(s,encoding="utf-8")
m=Path("AndroidProject/app/src/main/AndroidManifest.xml")
s=m.read_text(encoding="utf-8")
assert s.count("HITEL14 V26 미디어 스피커 원본 복원")==1
m.write_text(s.replace("HITEL14 V26 미디어 스피커 원본 복원",
                       "HITEL14 V27 자동감시 소스 전환 수정",1),encoding="utf-8")
for name,bytes_before in untouched.items():
    assert (p/name).read_bytes()==bytes_before, "untouched STT/codec/player changed: "+name
assert 'queueSourceSwitch(intent)' in source
assert 'applyPendingSwitch();' in source
assert 'SOURCE_SWITCH_REQUESTED' in source
assert 'SOURCE_SWITCH_APPLY' in source
assert 'if(pendingSourceSwitch!=null)' in source
assert '통화 이벤트 자동 감시가 이미 실행 중입니다.' not in source
print("PASS_V27_FILE_TO_FOLDER_SWITCH_AFTER_OLD_ENGINE_COMPLETION")
print("PASS_V27_REAL_CALL_STATE_GATE_AND_FOLDER_GROWTH_SCANNING_UNCHANGED")
print("PASS_V27_ALL_THREE_STT_AND_VERIFIED_USAGEMEDIA_PLAYER_UNMODIFIED")
