package app.hitel.speakeronly;

import android.media.*;
import android.os.SystemClock;
import java.io.*;
import java.util.function.BooleanSupplier;

/** In-call music TX only. Never falls back to speaker or changes the microphone. */
final class CallTxPlayer {
  static final int RATE=48000, BLOCK=1920; // 20ms at 48kHz PCM16 mono
  private static boolean tx(AudioDeviceInfo d){return d!=null&&d.getType()==AudioDeviceInfo.TYPE_TELEPHONY&&d.isSink();}
  private static void check(AudioManager a,BooleanSupplier alive)throws IOException{
    if(!alive.getAsBoolean()||a.getMode()!=AudioManager.MODE_IN_CALL)throw new IOException("CALL_ENDED_OR_NOT_VOICE_PATH");
  }
  static long send(AudioManager a,InputStream in,long bytes,BooleanSupplier alive)throws Exception{
    if(bytes<=0||(bytes&1)!=0||bytes>CallTxDecode.MAX_BYTES)throw new IOException("PCM length");
    check(a,alive);
    AudioDeviceInfo target=null;
    for(AudioDeviceInfo d:a.getDevices(AudioManager.GET_DEVICES_OUTPUTS))if(tx(d)){target=d;break;}
    if(target==null)throw new IOException("NO_TELEPHONY_TX_DEVICE");
    AudioTrack tr=new AudioTrack.Builder()
      .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
      .setAudioFormat(new AudioFormat.Builder().setSampleRate(RATE).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
      .setTransferMode(AudioTrack.MODE_STREAM)
      .build();
    try{
      if(tr.getState()!=AudioTrack.STATE_INITIALIZED||!tr.setPreferredDevice(target))throw new IOException("TX_TRACK_NOT_INITIALIZED_OR_ROUTE_REJECTED");
      tr.play();
      // Prime with silence only; never send selected voice until the actual route is confirmed.
      write(tr,a,new byte[BLOCK],BLOCK,alive,false);
      long until=SystemClock.elapsedRealtime()+1500;
      while(!tx(tr.getRoutedDevice())){
        check(a,alive);
        if(SystemClock.elapsedRealtime()>until)throw new IOException("TX_ROUTE_NOT_CONFIRMED");
        SystemClock.sleep(10);
      }
      android.util.Log.i("HITEL_CALL_TX","TX_ROUTE_CONFIRMED id="+tr.getRoutedDevice().getId());
      byte[] block=new byte[BLOCK];long remaining=bytes;
      DataInputStream data=new DataInputStream(in);
      while(remaining>0){
        check(a,alive);
        int n=(int)Math.min(block.length,remaining);
        data.readFully(block,0,n);
        write(tr,a,block,n,alive,true);
        remaining-=n;
      }
      long frames=(bytes+BLOCK)/2,deadline=SystemClock.elapsedRealtime()+5000;
      while((tr.getPlaybackHeadPosition()&0xffffffffL)<frames){
        check(a,alive);
        if(!tx(tr.getRoutedDevice()))throw new IOException("TX_ROUTE_LOST");
        if(SystemClock.elapsedRealtime()>deadline)throw new IOException("TX_DRAIN_TIMEOUT");
        SystemClock.sleep(10);
      }
      android.util.Log.i("HITEL_CALL_TX","TX_LOCAL_DRAIN_COMPLETE frames="+frames+" underruns="+tr.getUnderrunCount());
      return bytes;
    }finally{
      try{tr.pause();tr.flush();}catch(Exception ignored){}
      tr.release();
    }
  }
  private static void write(AudioTrack tr,AudioManager a,byte[] block,int n,BooleanSupplier alive,boolean routed)throws IOException{
    int off=0;long deadline=SystemClock.elapsedRealtime()+3000;
    while(off<n){
      check(a,alive);
      if(routed&&!tx(tr.getRoutedDevice()))throw new IOException("TX_ROUTE_LOST");
      int k=tr.write(block,off,n-off,AudioTrack.WRITE_NON_BLOCKING);
      if(k<0)throw new IOException("TX_WRITE_FAILED "+k);
      if(k==0){if(SystemClock.elapsedRealtime()>deadline)throw new IOException("TX_WRITE_STALLED");SystemClock.sleep(5);}
      else {off+=k;deadline=SystemClock.elapsedRealtime()+3000;}
    }
  }
}
