import zipfile,sys,re,json
from androguard.core.dex import DEX
from loguru import logger
logger.remove()
targets=re.compile(r'AudioTrack;->|setPreferredDevice|TYPE_TELEPHONY|getCallUplinkInjectionAudioTrack|setCallAudio|setAudioPath|setParameters|setMicrophoneMute|setMode\(|setMode\s|synthesizeToFile|TextToSpeech;->|SemAudio|CallAudio|AudioSystem;->|MODIFY_PHONE_STATE|CALL_AUDIO_INTERCEPTION|ROLE_DIALER|IN_CALL_SERVICE',re.I)
names=re.compile(r'tts|texttospeech|synthesi|uplink|in.?callmusic|voice.?tx|call.?audio|audio.?route|answer.?bot|voice.?bot|text.?call|call.?assist|call.?screen',re.I)
for apk in sys.argv[1:]:
 print("APK",apk,flush=True)
 from androguard.core.apk import APK
 a=APK(apk)
 print("PACKAGE",a.get_package(),"PERMISSIONS",json.dumps([p for p in a.get_permissions() if re.search('PHONE|AUDIO|CALL|RECORD|DIAL',p)]),flush=True)
 root=a.get_android_manifest_xml()
 for e in root.xpath('.//service'):
  z=e.attrib
  if re.search('call|audio|tts|record',str(z),re.I): print('MANIFEST_SERVICE',json.dumps(dict(z),ensure_ascii=False))
 with zipfile.ZipFile(apk) as z:
  for fn in z.namelist():
   if not re.fullmatch(r'classes\d*\.dex',fn):continue
   d=DEX(z.read(fn)); print("DEX",fn,"classes",len(d.get_classes()),flush=True)
   for cl in d.get_classes():
    cn=cl.get_name()
    own=bool(re.search(r'^L(com/lguplus|com/pineone|com/ix|com/kt|com/samsung)/',cn))
    if own and names.search(cn): print("CLASS",cn,flush=True)
    for m in cl.get_methods():
     code=m.get_code()
     if code is None:continue
     hits=[]
     for ins in m.get_instructions():
      if not (ins.get_name().startswith('invoke') or ins.get_name().startswith('const-string')): continue
      out=ins.get_output()
      if targets.search(out) or (own and re.search(r'(?i)incall_music|telephony.tx|voice_tx|call_uplink|call.audio.interception|modify_phone_state',out)):hits.append(out)
     if hits:
      print("CALLSITE",cn,m.get_name(),m.get_descriptor(),json.dumps(list(dict.fromkeys(hits)),ensure_ascii=False),flush=True)
 print("APK_SCAN_COMPLETE",apk,flush=True)
