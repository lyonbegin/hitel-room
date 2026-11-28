import zipfile,sys,re
from androguard.core.dex import DEX
from androguard.core.apk import APK
from loguru import logger
logger.remove()
classes=re.compile(r'/(InCallAiPcmPlayer|PcmPlayerRepositoryImpl|VoiceCommunicationPlayerHelper|AISoundRepositoryImpl|IInCallAidlInterface|PermissionString|PermissionUtil)(;|\$)')
calls=re.compile(r'InCallAiPcmPlayer;->|PcmPlayerRepositoryImpl;->|VoiceCommunicationPlayerHelper;->|IInCallAidlInterface;->[^ ]*(?:Pcm|PCM|Audio|Tts|TTS|Play)|getCallUplinkInjectionAudioTrack|incall_music|createRequestRoleIntent|ROLE_DIALER|android.app.role.DIALER|setDefaultDialer',re.I)
for fn in sys.argv[1:]:
 print("APK",fn,flush=True)
 a=APK(fn)
 for e in a.get_android_manifest_xml().xpath(".//uses-permission"):
  x=dict(e.attrib)
  if any(re.search(r'AUDIO|MODIFY_PHONE_STATE|CALL_AUDIO|IN_CALL|SAMSUNG|SEC_',str(v),re.I) for v in x.values()): print("PERM",x,flush=True)
 with zipfile.ZipFile(fn) as z:
  for name in z.namelist():
   if not re.fullmatch(r'classes\d*\.dex',name):continue
   data=z.read(name)
   if not any(s in data for s in [b'InCallAiPcmPlayer',b'PcmPlayerRepositoryImpl',b'VoiceCommunicationPlayerHelper',b'AISoundRepositoryImpl',b'IInCallAidlInterface',b'PermissionString',b'PermissionUtil',b'getCallUplinkInjectionAudioTrack',b'incall_music',b'android.app.role.DIALER',b'createRequestRoleIntent']):continue
   d=DEX(data)
   for cl in d.get_classes():
    cn=cl.get_name()
    for m in cl.get_methods():
     if not m.get_code():continue
     dump=classes.search(cn) and (re.search(r'createAudioTrack|startPlayer|writeToTrack|playAudio|find|Device|enqueue|write|feed|playPCM|playPcm|isRequirePermission|<clinit>|getRequirePermissionList',m.get_name(),re.I) or cn.endswith('/InCallAiPcmPlayer;') or cn.endswith('/PcmPlayerRepositoryImpl;'))
     ins=list(m.get_instructions())
     if dump:
      print("METHOD",name,cn,m.get_name(),m.get_descriptor(),flush=True)
      for i in ins:print("INS",i.get_name(),i.get_output())
     elif cn.startswith(('Lcom/lguplus/','Lcom/pineone/')):
      for i in ins:
       if (i.get_name().startswith('invoke') or i.get_name().startswith('const-string')) and calls.search(i.get_output()):print("CALLER",name,cn,m.get_name(),i.get_output(),flush=True)
 print("COMPLETE",fn,flush=True)
