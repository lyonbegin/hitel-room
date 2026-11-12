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
    private volatile long lastSourceStatusAt=0;
    private volatile long lastOutputStatusAt=0;
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
    /**
     * Samsung's DocumentsProvider may take ~40 seconds for 25 loops over
     * 36 files if we open each file every scan (real user log W03_154308).
     * Metadata is queried once per file, and file descriptors are probed
     * for the two freshest files plus two rotating candidates each pass.
     * Detects both a new recording and a preexisting recording that grows.
     */
    private static final class FileSnapshot {
        final DocumentFile file;
        final String key;
        final long size;
        final long modified;
        final String name;
        FileSnapshot(DocumentFile file,String name,long size,long modified){
            this.file=file;
            this.key=file.getUri().toString();
            this.name=name;
            this.size=size;
            this.modified=modified;
        }
    }
    private DocumentFile waitForGrowingFile()throws Exception{
        DocumentFile dir=DocumentFile.fromTreeUri(app,folderUri);
        if(dir==null||!dir.isDirectory())
            throw new IOException("삼성 통화 녹음 폴더로 사용할 수 없는 URI입니다.");
        event("FOLDER_WATCH","녹음 폴더 감시 시작 · 목록 및 최신 파일 실제 증가량 확인");
        HashMap<String,Long> baselineLength=new HashMap<>();
        HashMap<String,Long> baselineModified=new HashMap<>();
        HashMap<String,Long> actualLength=new HashMap<>();
        long lastWaiting=0;
        int scans=0;
        while(!stop){
            long scanBegin=SystemClock.elapsedRealtime();
            DocumentFile[] children=dir.listFiles();
            java.util.ArrayList<FileSnapshot> candidates=new java.util.ArrayList<>();
            FileSnapshot selected=null;
            int changes=0;
            for(DocumentFile file:children){
                String name=file.getName();
                if(name==null)continue;
                String lower=name.toLowerCase(Locale.US);
                if(!(lower.endsWith(".m4a")||lower.endsWith(".3gp")||
                     lower.endsWith(".mp4")||lower.endsWith(".aac")))continue;
                if(!file.isFile())continue;
                long size=file.length();
                long modified=file.lastModified();
                FileSnapshot snapshot=new FileSnapshot(file,name,size,modified);
                Long before=baselineLength.put(snapshot.key,size);
                Long priorTime=baselineModified.put(snapshot.key,modified);
                if(scans>0 && size>=1024 &&
                    (before==null || size>before ||
                     (priorTime!=null && modified>priorTime))){
                    changes++;
                    if(selected==null || modified>selected.modified)
                        selected=snapshot;
                }
                candidates.add(snapshot);
            }
            if(selected!=null){
                long bytes=readableSize(selected.file);
                if(bytes>=1024){
                    selectedName=selected.name;
                    event("FILE_SELECTED","신규/증가 파일: "+selectedName+
                        " · 실제 열람 가능 "+bytes+"B · scan="+scans);
                    return selected.file;
                }
            }
            // Sort CACHED timestamps. Never invoke DocumentFile.lastModified
            // from a sort comparator (each call is another SAF binder query).
            candidates.sort((a,b)->{
                int c=Long.compare(b.modified,a.modified);
                return c!=0?c:b.name.compareToIgnoreCase(a.name);
            });
            java.util.HashSet<String> checked=new java.util.HashSet<>();
            int total=candidates.size();
            for(int slot=0;slot<4 && total>0;slot++){
                // First two newest; next two rotate through all recordings.
                int at=slot<2?Math.min(slot,total-1):
                    (int)(((long)scans*2+slot-2)%total);
                FileSnapshot candidate=candidates.get(at);
                if(!checked.add(candidate.key))continue;
                long current=readableSize(candidate.file);
                Long prior=actualLength.put(candidate.key,current);
                if(scans>0&&prior!=null&&current>prior&&current>=1024){
                    selectedName=candidate.name;
                    event("FILE_SELECTED","실제 파일 크기 증가: "+selectedName+
                        " · "+prior+"B → "+current+"B · scan="+scans);
                    return candidate.file;
                }
            }
            scans++;
            long now=SystemClock.elapsedRealtime();
            if(scans==1 || now-lastWaiting>=4000){
                lastWaiting=now;
                event("FOLDER_WAITING","녹음 후보="+total+"개 · 실제 길이 검사 대상=최대 4개"+
                    " · 신규 증가분 미검출 · scan="+scans+
                    " · scanDurationMs="+(now-scanBegin)+
                    " · treeChanges="+changes);
            }
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
                }catch(Exception e){
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
    /**
     * Read the ACTUAL bytes available at the current source offset on every
     * pass, NOT the potentially cached size returned by DocumentFile.length().
     *
     * The previous version used "available == mirroredBytes" as an early
     * exit and therefore could stay silent forever on some Samsung SAF
     * providers even while the recording file continued growing.
     * This always reopens the source and reads only NEW bytes into the same
     * append-only mirror; native aac_mdat_follow remains the original source.
     */
    private synchronized void appendNewBytes(DocumentFile selected)throws Exception{
        long reported=readableSize(selected);
        long offset=mirroredBytes;
        long limit=512L*1024; // bounded work per 180 ms polling cycle
        try(InputStream in=openDelta(selected.getUri(),offset);
            FileOutputStream out=new FileOutputStream(mirror,true)){
            byte[] buffer=new byte[32768];
            while(limit>0 && !stop){
                int n=in.read(buffer,0,(int)Math.min(buffer.length,limit));
                if(n<0)break; // snapshot EOF; reopen at same cursor next poll
                if(n==0)break;
                out.write(buffer,0,n);
                mirroredBytes+=n;
                limit-=n;
            }
            out.flush();
        }
        long copied=mirroredBytes-offset;
        if(copied>0){
            lastWriteAt=SystemClock.elapsedRealtime();
            log.event("MIRROR","SOURCE_DELTA_APPENDED","newBytes",copied,
                "totalBytes",mirroredBytes,"providerSize",reported,
                "recording",selectedName);
            if(lastWriteAt-lastSourceStatusAt>=1500 || offset==0){
                lastSourceStatusAt=lastWriteAt;
                event("SOURCE_GROWING","녹음파일 증가분 "+copied+
                    "B · 누적 "+mirroredBytes+"B · AAC 추출 대기");
            }
        }else{
            long now=SystemClock.elapsedRealtime();
            if(now-lastSourceStatusAt>4500){
                lastSourceStatusAt=now;
                event("SOURCE_NO_NEW_BYTES",
                    "선택된 파일이 현재 읽을 수 있는 새 바이트를 제공하지 않습니다."+
                    " providerSize="+reported+"; mirrored="+mirroredBytes);
            }
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
        AudioDeviceInfo routed=playback.getRoutedDevice();
        AudioManager manager=(AudioManager)app.getSystemService(Context.AUDIO_SERVICE);
        int volume=manager.getStreamVolume(AudioManager.STREAM_MUSIC);
        int maxVolume=manager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        event("AUDIO_ROUTE",
            "AudioTrack PLAY · usage=MEDIA · preferred/routed="+
            (routed==null?"unknown":routed.getType())+
            " · mediaVolume="+volume+"/"+maxVolume+
            " · audioMode="+manager.getMode());
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
        long now=SystemClock.elapsedRealtime();
        if(now-lastOutputStatusAt>1200 || renderedBytes<=6400){
            lastOutputStatusAt=now;
            long sumSquares=0;
            int count=0;
            for(int i=0;i+1<pcm.length;i+=2){
                short v=(short)((pcm[i]&255)|((pcm[i+1]&255)<<8));
                sumSquares+=(long)v*v;
                count++;
            }
            double rms=count==0?0:Math.sqrt((double)sumSquares/count)/32768.0;
            AudioDeviceInfo routed=output.getRoutedDevice();
            event("PCM_WRITTEN",
                "실제 녹음 증가분→AudioTrack: "+
                (renderedBytes/32000.0)+"초 · rms="+
                String.format(Locale.US,"%.5f",rms)+
                " · speakerRoute="+(routed==null?"unknown":routed.getType())+
                " · playState="+output.getPlayState());
        }
    }
    private void followAndPlay()throws Exception{
        File helper=new File(app.getApplicationInfo().nativeLibraryDir,"libaac-mdat-follow.so");
        if(!helper.isFile()||!helper.canExecute())
            throw new IOException("원본 AAC 실시간 팔로워 실행파일 없음: "+helper);
        track=makeOutput();
        event("PLAYER_READY","AudioTrack 재생 장치 준비. 실제 AAC 프레임/PCM 입력을 기다립니다.");
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
                        else if(line.startsWith("AAC_FOLLOW_STARTED:"))event("AAC_FOLLOW_STARTED",line);
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
            event("AAC_WAIT","원본 AAC 팔로워 시작 · 녹음파일 증가분에서 유효한 AAC 프레임을 기다립니다.");
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
