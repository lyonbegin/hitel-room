package app.hitel.speakeronly;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.SystemClock;
import java.io.IOException;

/**
 * Dedicated 16,000 Hz mono PCM16 call-recording speaker monitor.
 * Construct AudioTrack ONLY on the first actual PCM packet: a track started
 * before the phone call can be silenced by Android's in-call audio policy.
 * Route preference != actual route; expose both. Never alter phone call route.
 */
final class PcmSpeakerMonitor implements AutoCloseable {
  static final int RATE=16000;
  interface StatusSink {void status(String message);}
  private final Context context;
  private final AudioManager manager;
  private final TraceJournal log;
  private final StatusSink callback;
  private AudioTrack track;
  private int requestedId;
  private int lastRoutedId=Integer.MIN_VALUE;
  private long totalWritten;
  private long writeCount;
  private boolean stopped;

  PcmSpeakerMonitor(Context ctx,TraceJournal journal,int routeId,StatusSink cb){
    context=ctx.getApplicationContext();
    manager=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
    log=journal;
    callback=cb;
    requestedId=routeId;
    log.event("SPEAKER","MONITOR_CREATED_WITHOUT_PLAYBACK",
        "sampleRateHz",RATE,"pcmBits",16,"channels",1,
        "requestedDeviceId",routeId,"sttEnabled",false,
        "reason","AudioTrack starts on first decoded PCM, not before phone call");
  }

  static String typeName(int type){
    switch(type){
      case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER:return "내장 스피커";
      case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE:return "수화부";
      case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP:return "블루투스 음악 출력";
      case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:return "블루투스 통화 이어폰";
      case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:return "유선 헤드폰";
      case AudioDeviceInfo.TYPE_WIRED_HEADSET:return "유선 이어폰";
      case AudioDeviceInfo.TYPE_USB_DEVICE:return "USB 오디오";
      case AudioDeviceInfo.TYPE_USB_HEADSET:return "USB-C 이어폰";
      default:
        if(Build.VERSION.SDK_INT>=31){
          if(type==AudioDeviceInfo.TYPE_BLE_HEADSET)return "블루투스 LE 이어폰";
          if(type==AudioDeviceInfo.TYPE_BLE_SPEAKER)return "블루투스 LE 스피커";
        }
        return "오디오 장치 "+type;
    }
  }
  static String label(AudioDeviceInfo d){
    if(d==null)return "아직 라우팅 안 됨";
    String name=typeName(d.getType());
    try{
      CharSequence product=d.getProductName();
      if(product!=null&&!product.toString().isEmpty())
        name+=" · "+product;
    }catch(SecurityException ignored){}
    return name+" (#"+d.getId()+")";
  }

  static AudioDeviceInfo findDevice(AudioManager audio,int id){
    if(audio==null||id<0)return null;
    for(AudioDeviceInfo device:audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS))
      if(device.getId()==id)return device;
    return null;
  }
  static AudioDeviceInfo builtInSpeaker(AudioManager audio){
    if(audio==null)return null;
    for(AudioDeviceInfo device:audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS))
      if(device.getType()==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER)return device;
    return null;
  }

  private void openOnFirstAudio() throws IOException {
    if(track!=null)return;
    int min=AudioTrack.getMinBufferSize(RATE,
        AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_16BIT);
    if(min<=0)throw new IOException("AudioTrack 16kHz unsupported: "+min);
    int capacity=Math.max(min,RATE*2/4);
    AudioAttributes attributes=new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
    AudioFormat format=new AudioFormat.Builder().setSampleRate(RATE)
        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT).build();
    AudioTrack next=new AudioTrack(attributes,format,capacity,AudioTrack.MODE_STREAM,0);
    if(next.getState()!=AudioTrack.STATE_INITIALIZED){
      next.release();throw new IOException("AudioTrack init failed");
    }
    // User selection is a preference: actual device routing is system policy.
    AudioDeviceInfo target=requestedId>=0?
        findDevice(manager,requestedId):builtInSpeaker(manager);
    boolean preferenceAccepted=false;
    if(target!=null)preferenceAccepted=next.setPreferredDevice(target);
    next.setVolume(1.0f);
    next.play();
    if(next.getPlayState()!=AudioTrack.PLAYSTATE_PLAYING){
      next.release();throw new IOException("AudioTrack did not start");
    }
    track=next;
    log.event("SPEAKER","SPEAKER_TRACK_STARTED",
      "sampleRateHz",RATE,"pcmBits",16,"channels",1,
      "usage","VOICE_COMMUNICATION","requestedDeviceId",requestedId,
      "selectedDevice",label(target),"preferenceAccepted",preferenceAccepted,
      "bufferBytes",capacity,"sttProcessStarted",false);
    reportRoute(true);
  }

  synchronized void setOutputDevice(int deviceId){
    requestedId=deviceId;
    if(stopped)return;
    AudioDeviceInfo selected=deviceId>=0?
        findDevice(manager,deviceId):builtInSpeaker(manager);
    boolean accepted=false;
    if(track!=null)accepted=track.setPreferredDevice(selected);
    log.event("SPEAKER","USER_OUTPUT_SELECTION",
        "id",deviceId,"wanted",label(selected),
        "preferenceAccepted",accepted,"trackAlreadyStarted",track!=null);
    callback.status("출력 요청: "+(selected==null?"자동":label(selected))+
        (track==null?" · PCM 대기 중":accepted?" · 경로 적용 요청됨":" · 연결/라우팅 확인 필요"));
    if(track!=null)reportRoute(true);
  }

  private void reportRoute(boolean force){
    if(track==null)return;
    AudioDeviceInfo routed=track.getRoutedDevice();
    int id=routed==null?-1:routed.getId();
    if(force||id!=lastRoutedId){
      lastRoutedId=id;
      String route=label(routed);
      log.event("SPEAKER","ACTUAL_OUTPUT_ROUTE",
          "requestedDeviceId",requestedId,
          "routedDeviceId",id,"actualRoute",route,
          "callMode",manager.getMode(),
          "volume",manager.getStreamVolume(AudioManager.STREAM_VOICE_CALL));
      callback.status("16kHz 재생 중 · 실제 출력: "+route);
    }
  }

  synchronized void write(byte[] pcm) throws IOException {
    if(stopped)throw new IOException("Audio monitor stopped");
    if(pcm==null||pcm.length==0)return;
    if((pcm.length&1)!=0)throw new IOException("Odd PCM16 bytes "+pcm.length);
    openOnFirstAudio();
    long started=SystemClock.elapsedRealtimeNanos();
    int offset=0;
    while(offset<pcm.length){
      int n=track.write(pcm,offset,pcm.length-offset,AudioTrack.WRITE_BLOCKING);
      if(n<=0)throw new IOException("AudioTrack.write="+n);
      offset+=n;
    }
    totalWritten+=pcm.length;
    writeCount++;
    long played=(track.getPlaybackHeadPosition()&0xffffffffL)*1000/RATE;
    log.timingAt(SystemClock.elapsedRealtimeNanos(),"SPEAKER","PCM_PLAYBACK_WRITE",
        "pcmBytes",pcm.length,"totalPcmBytes",totalWritten,
        "writtenAudioMs",totalWritten/32,"playedAudioMs",played,
        "writeDurationMs",(SystemClock.elapsedRealtimeNanos()-started)/1000000.0,
        "playState",track.getPlayState(),"routeId",lastRoutedId);
    if(writeCount==1||writeCount%5==0){
      reportRoute(false);
      log.event("SPEAKER","PLAYBACK_PROGRESS",
          "chunks",writeCount,"writtenPcmBytes",totalWritten,
          "writtenAudioMs",totalWritten/32,
          "playedAudioMs",played,"playState",track.getPlayState(),
          "actualRoute",label(track.getRoutedDevice()));
      callback.status("16kHz PCM: "+String.format(java.util.Locale.US,"%.1f",
            totalWritten/32000.0)+"초 · 실제 출력: "+label(track.getRoutedDevice()));
    }
  }

  @Override public synchronized void close(){
    if(stopped)return;
    stopped=true;
    if(track==null){
      log.event("SPEAKER","NO_PCM_PLAYBACK_TRACK_CREATED",
          "reason","No PCM reached output");
      return;
    }
    long played=(track.getPlaybackHeadPosition()&0xffffffffL)*1000/RATE;
    log.event("SPEAKER","SPEAKER_TRACK_FINISHED",
      "writtenPcmBytes",totalWritten,"writtenAudioMs",totalWritten/32,
      "playedAudioMs",played,"chunks",writeCount,
      "actualRoute",label(track.getRoutedDevice()));
    try{track.stop();}catch(IllegalStateException ignored){}
    track.release();track=null;
  }
}
