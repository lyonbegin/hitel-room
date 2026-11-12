package app.hitel.samsungprobe;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import androidx.documentfile.provider.DocumentFile;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.DataInputStream;
import java.io.EOFException;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * EXTRA FEATURE ONLY: copied/adapted source from experiment/
 * hitel14-official-ko-zipformer-stt-20261112:
 *
 * GrowingCallEngine.waitForGrowingFile + appendMirror +
 * processPersistentAacFollow, ORIGINAL aac_mdat_follow.c and ORIGINAL
 * StreamingAacPcmDecoder.feedAdtsFrame.
 *
 * Deliberate ONE output change:
 *   original decoder's PCM -> Sherpa STT, HERE PCM -> Android AudioTrack
 *   configured as capturable USAGE_MEDIA. The existing speaker STT is NOT
 *   changed or started by this module.
 *
 * Selected folder is read-only via SAF. Never edits Samsung's recording.
 */
final class RecordingFolderPlaybackEngine {
    interface Listener { void onEvent(String state,String detail); }
    private static final int OUTPUT_RATE=16000;
    private static final long POLL_MS=180;
    private final Context app;
    private final Uri folderUri;
    private final Listener listener;
    private final PlaybackTraceJournal log=new PlaybackTraceJournal();
    private volatile boolean stop=false;
    private volatile boolean done=false;
    private volatile Process follower;
    private volatile Thread worker;
    private volatile Thread monitor;
    private volatile AudioTrack track;
    private volatile File mirror;
    private volatile long mirroredBytes=0;
    private volatile long newAacFrames=0;
    private volatile long renderedBytes=0;
    private volatile long sourceCursor=0;
    private volatile long lastWriteAt=0;
    private volatile String selectedName="";

    RecordingFolderPlaybackEngine(Context app,Uri folder,Listener callback) {
        this.app=app.getApplicationContext();
        this.folderUri=folder;
        this.listener=callback;
    }
    boolean isDone(){return done;}
    void start(){
        worker=new Thread(this::run,"HITEL-Samsung-Growing-File-AudioTrack");
        worker.start();
    }
    void stop(){
        stop=true;
        Process p=follower;
        if(p!=null)p.destroy();
        Thread m=monitor;
        if(m!=null)m.interrupt();
        Thread w=worker;
        if(w!=null)w.interrupt();
        AudioTrack output=track;
        if(output!=null)try{output.pause();output.flush();}catch(Throwable ignored){}
    }
    private void event(String state,String detail){
        log.event("PLAYER",state,"detail",detail);
        listener.onEvent(state,detail);
    }
    private static boolean audio(DocumentFile f){
        String n=f.getName();
        if(n==null)return false;
        String name=n.toLowerCase(Locale.US);
        return name.endsWith(".m4a")||name.endsWith(".3gp")||
            name.endsWith(".mp4")||name.endsWith(".aac");
    }
    /** Uses fstat on a freshly opened descriptor, not only cached SAF metadata.
     * This is the original GrowingCallEngine strategy for actively written files.
     */
    private long readableSize(DocumentFile file){
        long listed=file.length();
        try(ParcelFileDescriptor fd=app.getContentResolver().openFileDescriptor(file.getUri(),"r")){
            if(fd!=null){
                long actual=fd.getStatSize();
                if(actual>=0)return actual;
            }
        }catch(Throwable e){
            log.error("FOLDER","STAT_UNAVAILABLE",e);
        }
        return listed;
    }
    /** Baseline existing recordings first; select ONLY newly created/growing file. */
    private DocumentFile waitForGrowingFile()throws Exception{
        DocumentFile dir=DocumentFile.fromTreeUri(app,folderUri);
        if(dir==null||!dir.isDirectory())
            throw new IOException("삼성 통화 녹음 폴더로 사용할 수 없는 URI입니다.");
        event("FOLDER_WATCH","통화 녹음 폴더 감시 시작 · 새로 생성되거나 증가하는 녹음파일을 기다립니다.");
        HashMap<String,Long> baseline=new HashMap<>();
        int scans=0;
        while(!stop){
            DocumentFile[] children=dir.listFiles();
            DocumentFile choice=null;
            long latest=-1;
            for(DocumentFile f:children){
                if(!f.isFile()||!audio(f))continue;
                String key=f.getUri().toString();
                long size=readableSize(f);
                Long old=baseline.put(key,size);
                if(scans>0 && size>=1024 && (old==null||old.longValue()!=size)){
                    long mtime=f.lastModified();
                    if(choice==null||mtime>=latest){choice=f;latest=mtime;}
                }
            }
            if(choice!=null){
                selectedName=String.valueOf(choice.getName());
                event("FILE_SELECTED","증가하는 파일: "+selectedName+
                    " · 현재 읽기 가능 바이트="+readableSize(choice));
                return choice;
            }
            scans++;
            if(scans%25==0)
                event("FOLDER_WAITING","감시 중 · "+children.length+
                    "개 항목 · 신규 파일/증가분 대기");
            Thread.sleep(POLL_MS);
        }
        return null;
    }
    /** Source is not rewound for actual AAC decoding. Only missing source bytes
     * are appended to our private mirror; native follower is continuously open.
     * Safely supports a seekable PFD and an InputStream skip fallback.
     */
    private InputStream openDelta(Uri uri,long offset)throws Exception{
        try{
            ParcelFileDescriptor fd=app.getContentResolver().openFileDescriptor(uri,"r");
            if(fd!=null){
                try{
                    FileInputStream seekable=new FileInputStream(fd.getFileDescriptor());
                    try{
                        seekable.getChannel().position(offset);
                        // close of FileInputStream owns the descriptor;
                        // do not separately close the PFD on successful transfer
                        return seekable;
                    }catch(Throwable e){
                        seekable.close();
                        log.event("MIRROR","SEEK_UNAVAILABLE","offset",offset,"reason",String.valueOf(e));
                    }
                }catch(Throwable e){
                    fd.close();
                    throw e;
                }
            }
        }catch(Throwable e){
            log.event("MIRROR","DIRECT_FD_FALLBACK","reason",String.valueOf(e));
        }
        InputStream fallback=app.getContentResolver().openInputStream(uri);
        if(fallback==null)throw new IOException("녹음 파일 URI를 읽을 수 없습니다.");
        long rest=offset;
        try{
            while(rest>0){
                long n=fallback.skip(rest);
                if(n<=0){
                    if(fallback.read()<0)throw new EOFException("녹음파일이 기존 읽은 길이보다 짧습니다.");
                    n=1;
                }
                rest-=n;
            }
            return fallback;
        }catch(Exception e){fallback.close();throw e;}
    }
    /** One append-only mirror for the original native follower. */
    private synchronized void appendNewBytes(DocumentFile selected)throws Exception{
        long available=readableSize(selected);
        if(available<mirroredBytes)
            throw new IOException("원본 녹음파일이 축소/교체되었습니다. 새 감시 세션을 시작해야 합니다.");
        if(available==mirroredBytes || available<0)return;
        long amount=available-mirroredBytes;
        if(amount>50L*1024*1024)
            throw new IOException("한 번의 파일 증가량이 50MB를 초과합니다.");
        long remaining=amount;
        try(InputStream in=openDelta(selected.getUri(),mirroredBytes);
            FileOutputStream out=new FileOutputStream(mirror,true)){
            byte[] buffer=new byte[65536];
            while(remaining>0 && !stop){
                int n=in.read(buffer,0,(int)Math.min(buffer.length,remaining));
                if(n<0)break;
                if(n==0)continue;
                out.write(buffer,0,n);
                remaining-=n;
                mirroredBytes+=n;
            }
            out.flush();
        }
        if(amount!=remaining){
            lastWriteAt=SystemClock.elapsedRealtime();
            if(mirroredBytes<16384 || mirroredBytes%(256*1024)<amount)
                log.event("MIRROR","APPENDED","newBytes",amount-remaining,
                    "totalBytes",mirroredBytes,"file",selectedName);
        }
    }
    private AudioTrack makeOutput(){
        int min=AudioTrack.getMinBufferSize(OUTPUT_RATE,
            AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_16BIT);
        if(min<=0)throw new IllegalStateException("PCM 16kHz media output unsupported: "+min);
        AudioAttributes attrs=new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .setAllowedCapturePolicy(AudioAttributes.ALLOW_CAPTURE_BY_ALL)
            .build();
        AudioTrack playback=new AudioTrack.Builder()
            .setAudioAttributes(attrs)
            .setAudioFormat(new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(OUTPUT_RATE)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build())
            .setBufferSizeInBytes(Math.max(16384,min*2))
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build();
        if(playback.getState()!=AudioTrack.STATE_INITIALIZED){
            playback.release();
            throw new IllegalStateException("AudioTrack 초기화 실패");
        }
        // Prefer built-in loudspeaker; actual routing can still be overridden
        // by telephony, Bluetooth, and user policy. This never captures mic.
        try{
            AudioManager manager=(AudioManager)app.getSystemService(Context.AUDIO_SERVICE);
            for(AudioDeviceInfo device:manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)){
                if(device.getType()==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER){
                    boolean preferred=playback.setPreferredDevice(device);
                    log.event("AUDIO","BUILTIN_SPEAKER_PREFERRED","accepted",preferred);
                    break;
                }
            }
        }catch(Throwable ex){log.error("AUDIO","SPEAKER_ROUTE_REQUEST",ex);}
        playback.play();
        return playback;
    }
    private void sendToSpeaker(byte[] pcm)throws Exception{
        AudioTrack output=track;
        if(output==null||stop)return;
        int offset=0;
        while(offset<pcm.length && !stop){
            int n=output.write(pcm,offset,pcm.length-offset,AudioTrack.WRITE_BLOCKING);
            if(n<0)throw new IOException("AudioTrack.write failed: "+n);
            if(n==0){Thread.sleep(3);continue;}
            offset+=n;
            renderedBytes+=n;
        }
        if(renderedBytes<64000 || renderedBytes%(16000*8)<pcm.length)
            event("PCM_PLAYING","16kHz · 누적 재생 전송 "+(renderedBytes/32000.0)+"초"+
                " · AAC "+newAacFrames+"프레임");
    }
    private void followAndPlay()throws Exception{
        File helper=new File(app.getApplicationInfo().nativeLibraryDir,"libaac-mdat-follow.so");
        if(!helper.isFile()||!helper.canExecute())
            throw new IOException("원본 AAC 실시간 팔로워 실행파일 없음: "+helper);
        track=makeOutput();
        event("PLAYER_READY","전화 녹음파일 증가분을 우리 앱의 미디어 스피커로 재생합니다.");
        StreamingAacPcmDecoder decoder=new StreamingAacPcmDecoder(log);
        Process process=null;
        Thread stderr=null;
        try{
            ProcessBuilder builder=new ProcessBuilder(helper.getAbsolutePath(),
                mirror.getAbsolutePath(),"48000","1");
            builder.redirectErrorStream(false);
            String libraryDir=app.getApplicationInfo().nativeLibraryDir;
            String old=builder.environment().get("LD_LIBRARY_PATH");
            builder.environment().put("LD_LIBRARY_PATH",libraryDir+
                (old==null?"":":"+old));
            process=builder.start();
            follower=process;
            final Process live=process;
            stderr=new Thread(()->{
                try(BufferedReader r=new BufferedReader(new InputStreamReader(
                    live.getErrorStream(),StandardCharsets.UTF_8))){
                    String line;
                    while((line=r.readLine())!=null){
                        if(line.startsWith("AAC_FOLLOW_ERROR:"))event("AAC_FOLLOW_ERROR",line);
                        else if(line.startsWith("AAC_FOLLOW_READY:"))event("AAC_FOLLOW_READY",line);
                        else if(line.startsWith("AAC_FOLLOW_CURSOR:")){
                            log.event("AAC","CURSOR", "line",line);
                        }
                    }
                }catch(Throwable ex){
                    if(!stop)log.error("AAC","FOLLOW_STDERR",ex);
                }
            },"HITEL-AAC-Follow-StdErr");
            stderr.start();
            DataInputStream input=new DataInputStream(
                new BufferedInputStream(process.getInputStream(),65536));
            byte[] head=new byte[12];
            long prev=-1;
            while(!stop){
                try{input.readFully(head);}
                catch(EOFException end){
                    if(stop)break;
                    int code=live.isAlive()?-1:live.exitValue();
                    throw new IOException("AAC 프레임 스트림 종료 · exit="+code);
                }
                int n=(head[0]&255)|((head[1]&255)<<8)|
                    ((head[2]&255)<<16)|((head[3]&255)<<24);
                long cursor=0;
                for(int i=0;i<8;i++)cursor|=((long)(head[4+i]&255))<<(8*i);
                if(n<8||n>8192||cursor<=prev)
                    throw new IOException("원본 AAC 커서 오류: n="+n+" cursor="+cursor);
                byte[] adts=new byte[n];
                input.readFully(adts);
                decoder.feedAdtsFrame(adts,this::sendToSpeaker);
                newAacFrames++;
                sourceCursor=cursor;prev=cursor;
                if(newAacFrames==1 || newAacFrames%100==0)
                    log.event("AAC","FRAME_DECODED","count",newAacFrames,
                        "sourceCursor",sourceCursor,"mirroredBytes",mirroredBytes,
                        "speakerPcmBytes",renderedBytes);
            }
        }finally{
            Process old=follower;follower=null;
            if(old!=null)old.destroy();
            if(old!=null){
                try{old.waitFor(2,TimeUnit.SECONDS);}catch(InterruptedException ignored){}
                if(old.isAlive())old.destroyForcibly();
            }
            if(stderr!=null)try{stderr.join(1000);}catch(InterruptedException ignored){}
            // Original decoder flushes final PCM. On user stop, do not enqueue
            // stale speech after the audio output has been stopped.
            if(!stop){
                try{decoder.finish(this::sendToSpeaker);}
                catch(Throwable ex){log.error("AAC","EOS_FLUSH",ex);}
            }
            decoder.close();
        }
    }
    private void run(){
        try{
            DocumentFile selected=waitForGrowingFile();
            if(selected==null || stop)return;
            mirror=File.createTempFile("hitel14-growing-playback-", ".m4a", app.getCacheDir());
            mirroredBytes=0;
            appendNewBytes(selected);
            final DocumentFile recording=selected;
            monitor=new Thread(()->{
                int stable=0;
                while(!stop){
                    try{
                        long before=mirroredBytes;
                        appendNewBytes(recording);
                        if(before==mirroredBytes)stable++;else stable=0;
                        if(stable>0 && stable%60==0)
                            event("SOURCE_WAITING","전화 녹음파일 새 데이터 대기 · 현재 "+mirroredBytes+"바이트");
                        Thread.sleep(POLL_MS);
                    }catch(InterruptedException ex){break;}
                    catch(Throwable ex){
                        if(!stop)event("SOURCE_READ_ERROR",String.valueOf(ex));
                        stop=true;
                        Process p=follower;if(p!=null)p.destroy();
                        break;
                    }
                }
            },"HITEL-Growing-M4a-Saf-Mirror");
            monitor.start();
            followAndPlay();
        }catch(InterruptedException ex){
            if(!stop)event("INTERRUPTED",String.valueOf(ex));
        }catch(Throwable ex){
            if(!stop)event("FAILED",ex.getClass().getSimpleName()+": "+ex.getMessage());
        }finally{
            stop=true;
            Thread m=monitor;
            if(m!=null){m.interrupt();try{m.join(1500);}catch(InterruptedException ignored){}}
            Process p=follower;
            if(p!=null){p.destroy();if(p.isAlive())p.destroyForcibly();}
            AudioTrack output=track;track=null;
            if(output!=null){
                try{output.stop();}catch(Throwable ignored){}
                try{output.release();}catch(Throwable ignored){}
            }
            File f=mirror;mirror=null;
            if(f!=null&&!f.delete())
                log.event("MIRROR","DELETE_PENDING","path",f.getAbsolutePath());
            done=true;
            event("SESSION_END","파일="+selectedName+" · AAC 프레임="+newAacFrames+
                " · 스피커 PCM="+renderedBytes+"바이트");
        }
    }
}
