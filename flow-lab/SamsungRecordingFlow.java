package app.hitel.samsungprobe;

import android.content.Context;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.os.SystemClock;
import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Independent Samsung OEM call-recording -> completed M4A -> ASR lane.
 *
 * Never uses AudioRecord, TelecomManager.endCall(), ACTION_CALL or any mic
 * recognizer lifecycle. The existing HITEL14 microphone lane is untouched.
 */
final class SamsungRecordingFlow {
    private static final Object LOCK=new Object();
    private static final String PREF="samsung_recording_file_asr";
    private static final String PREF_LAST_FILE="last_completed_m4a";
    private static final ExecutorService WORKER=Executors.newSingleThreadExecutor();
    private static final File DIR=new File("/storage/emulated/0/Recordings/Call");
    private static final Map<String,Long> BASELINE=new HashMap<>();
    private static volatile Context appContext;
    private static volatile String phase="IDLE";
    private static volatile String details="삼성 전화 녹음 대기";
    private static volatile String text="";
    private static volatile String recordedFile="";
    private static volatile long armAt=0L;
    private static volatile long stopClickAt=0L;
    private static volatile boolean startClicked=false;
    private static volatile boolean stopRequested=false;
    private static volatile boolean stopClicked=false;
    private static volatile boolean processed=false;
    private static volatile File candidate=null;
    private static volatile long lastCandidateBytes=0L;

    static String phase(){return phase;}
    static String details(){return details;}
    static String transcript(){return text;}
    static String filePath(){return recordedFile;}
    static long armedAt(){return armAt;}
    static boolean isStartArmed(){
        return "WAIT_FOR_CALL".equals(phase)||"START_CLICKED".equals(phase);
    }
    static boolean shouldClickStart(){return "WAIT_FOR_CALL".equals(phase)&&!startClicked;}
    static boolean wantsStop(){
        return stopRequested&&!stopClicked&&"STOP_REQUESTED".equals(phase);
    }
    static boolean isStopClicked(){return stopClicked;}
    /** Re-run ASR on the exact previously confirmed file, without placing a call. */
    static boolean retryLastFile(Context context){
        if(context==null)return false;
        File last=new File(context.getApplicationContext()
            .getSharedPreferences(PREF,Context.MODE_PRIVATE)
            .getString(PREF_LAST_FILE,""));
        synchronized(LOCK){
            if("TRANSCRIBING".equals(phase)||"WAIT_FOR_FILE".equals(phase))return false;
            if(!isRecording(last)||!last.canRead()||!last.getParentFile().getAbsolutePath().equals(DIR.getAbsolutePath())){
                set("ERROR","전사할 기존 삼성 통화녹음 파일이 없습니다.");
                return false;
            }
            appContext=context.getApplicationContext();
            candidate=last;
            lastCandidateBytes=last.length();
            recordedFile=last.getAbsolutePath();
            processed=true;
            stopRequested=false;stopClicked=false;
            text="";
            set("WAIT_FOR_FILE","기존 완료 M4A 파일을 다시 전사합니다. 전화·마이크를 변경하지 않습니다.");
            LabStore.log("SAMSUNG_REC_RETRY_LAST_FILE",
                "path="+recordedFile+"; bytes="+lastCandidateBytes);
        }
        WORKER.execute(SamsungRecordingFlow::finalizeAndTranscribe);
        return true;
    }
    static void arm(Context context){
        synchronized(LOCK){
            appContext=context.getApplicationContext();
            // Reset only on explicit new call, never on telephony idle/onResume.
            if("TRANSCRIBING".equals(phase)||"WAIT_FOR_FILE".equals(phase)){
                set("BUSY","이전 녹음 파일 처리 중이므로 새 녹음을 시작하지 않습니다.");return;
            }
            BASELINE.clear();
            File[] files=DIR.listFiles();
            if(files!=null)for(File file:files)if(isRecording(file))
                BASELINE.put(file.getAbsolutePath(),file.length());
            armAt=System.currentTimeMillis();
            stopClickAt=0L;
            candidate=null;
            lastCandidateBytes=0L;
            recordedFile="";
            text="";
            startClicked=false;stopRequested=false;stopClicked=false;processed=false;
            set("WAIT_FOR_CALL","전화 연결을 기다립니다. 삼성 기본 전화의 녹음 시작 버튼만 조작합니다.");
            LabStore.log("SAMSUNG_REC_ARM",
                "baselineFiles="+BASELINE.size()+"; folder="+DIR+"; no mic or hangup actions");
        }
    }
    static void cancelBeforeStart(){
        synchronized(LOCK){
            if(!startClicked&&"WAIT_FOR_CALL".equals(phase))set("IDLE","녹음 시작 대기 해제");
        }
    }
    static void onStartClicked(boolean accepted){
        synchronized(LOCK){
            if(!shouldClickStart())return;
            startClicked=true;
            set(accepted?"START_CLICKED":"START_CLICK_FAILED",
                accepted?"삼성 녹음 버튼 클릭 수락. '녹음 중지' 표시를 기다립니다.":
                         "삼성 녹음 버튼 클릭이 거절되었습니다.");
            LabStore.log("SAMSUNG_REC_START_CLICK","accepted="+accepted);
        }
    }
    static void onRecordingUiActive(){
        synchronized(LOCK){
            if(!startClicked||stopClicked||processed)return;
            if("START_CLICKED".equals(phase)||"RECORDING".equals(phase)){
                if(!"RECORDING".equals(phase))set("RECORDING","삼성 '녹음 중지' 버튼을 관측했습니다. 전화는 유지 중입니다.");
            }
        }
        observeFiles();
    }
    static boolean requestStop(){
        synchronized(LOCK){
            if(!"RECORDING".equals(phase))return false;
            stopRequested=true;
            set("STOP_REQUESTED","사용자가 삼성 녹음 종료를 요청했습니다. 통화 종료는 요청하지 않습니다.");
            LabStore.log("SAMSUNG_REC_STOP_REQUEST","recording only; phone call retained");
            return true;
        }
    }
    static void onStopClicked(boolean accepted){
        synchronized(LOCK){
            if(!wantsStop())return;
            stopClicked=true;
            stopClickAt=System.currentTimeMillis();
            set(accepted?"STOP_CLICKED":"STOP_CLICK_FAILED",
                accepted?"삼성 '녹음 중지' 클릭 수락. 버튼 상태 변경 확인 대기":
                         "삼성 녹음 중지 클릭 실패. 통화는 건드리지 않았습니다.");
            LabStore.log("SAMSUNG_REC_STOP_CLICK","accepted="+accepted+"; no call termination");
        }
    }
    static void onStopControlGone(){
        synchronized(LOCK){
            if(!"STOP_CLICKED".equals(phase)||processed)return;
            processed=true;
            set("WAIT_FOR_FILE","녹음 종료 UI 확인. 완성된 파일·AAC 트랙 검증 중입니다.");
            LabStore.log("SAMSUNG_REC_STOP_CONFIRMED",
                "stopLabelAbsent; user phone call remains separate");
        }
        WORKER.execute(SamsungRecordingFlow::finalizeAndTranscribe);
    }
    static void observeFiles(){
        if(!"RECORDING".equals(phase)&&!"STOP_REQUESTED".equals(phase)&&
           !"STOP_CLICKED".equals(phase)&&!"WAIT_FOR_FILE".equals(phase))return;
        List<File> changed=new ArrayList<>();
        File[] files=DIR.listFiles();
        if(files==null)return;
        for(File file:files){
            if(!isRecording(file))continue;
            long old=BASELINE.getOrDefault(file.getAbsolutePath(),-1L);
            if(file.length()>old&&file.length()>0&&
               file.lastModified()>=armAt-5000L) changed.add(file);
        }
        synchronized(LOCK){
            if(candidate!=null){
                if(candidate.isFile())lastCandidateBytes=Math.max(lastCandidateBytes,candidate.length());
                return;
            }
            if(changed.size()==1){
                candidate=changed.get(0);
                lastCandidateBytes=candidate.length();
                recordedFile=candidate.getAbsolutePath();
                LabStore.log("SAMSUNG_REC_TRACKED_FILE","path="+recordedFile+"; size="+lastCandidateBytes);
            }else if(changed.size()>1){
                set(phase,"녹음 후보 파일 여러 개 발견. 다른 파일로 추측하여 전사하지 않습니다.");
                LabStore.log("SAMSUNG_REC_FILE_AMBIGUOUS","count="+changed.size());
            }
        }
    }
    private static boolean isRecording(File file){
        return file!=null&&file.isFile()&&file.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".m4a");
    }
    private static void finalizeAndTranscribe(){
        try{
            File file=candidate;
            if(file==null){
                long end=SystemClock.elapsedRealtime()+12_000L;
                while(SystemClock.elapsedRealtime()<end&&file==null){
                    observeFiles();file=candidate;
                    if(file==null)Thread.sleep(500);
                }
            }
            if(file==null)throw new IllegalStateException("녹음 시작 후 증가한 M4A 파일을 특정하지 못했습니다.");
            long stable=0L,last=-1L;
            long deadline=SystemClock.elapsedRealtime()+20_000L;
            while(SystemClock.elapsedRealtime()<deadline){
                long size=file.length();
                if(size>0&&size==last)stable++;else stable=0;
                if(stable>=3)break;
                last=size;
                Thread.sleep(700L);
            }
            if(stable<3)throw new IllegalStateException("녹음 파일이 종료 후에도 계속 바뀝니다.");
            // Verify both the original observed file identity and real codec track.
            if(!file.getAbsolutePath().equals(recordedFile)||!file.isFile())
                throw new IllegalStateException("추적 중이던 파일과 완료 파일이 다릅니다.");
            MediaExtractor extractor=new MediaExtractor();
            try{
                extractor.setDataSource(file.getAbsolutePath());
                boolean audio=false;
                for(int i=0;i<extractor.getTrackCount();i++){
                    MediaFormat format=extractor.getTrackFormat(i);
                    String mime=format.getString(MediaFormat.KEY_MIME);
                    if(mime!=null&&mime.startsWith("audio/"))audio=true;
                }
                if(!audio)throw new IllegalStateException("M4A 안에 디코딩 가능한 음성 트랙이 없습니다.");
            }finally{extractor.release();}
            appContext.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit()
                .putString(PREF_LAST_FILE,recordedFile).apply();
            set("TRANSCRIBING","완성 M4A 검증. 삼성 전화와 독립적으로 sherpa-onnx 전사 중입니다.");
            LabStore.log("SAMSUNG_REC_COMPLETE_M4A",
                "file="+file.getAbsolutePath()+"; bytes="+file.length());
            String result=SamsungCompletedM4aTranscriber.transcribe(file,appContext,
                new SamsungCompletedM4aTranscriber.Progress(){
                    @Override public void onPhase(String info){set("TRANSCRIBING",info);}
                    @Override public void onSentence(String sentence){
                        if(sentence==null||sentence.trim().isEmpty())return;
                        text=text.isEmpty()?sentence:text+"\n"+sentence;
                        LabStore.log("SAMSUNG_REC_ASR_SENTENCE",sentence);
                    }
                });
            if(result!=null&&!result.trim().isEmpty())text=result.trim();
            if(text.isEmpty())throw new IllegalStateException("파일은 디코딩되었으나 인식한 문장이 없습니다.");
            set("DONE","완료된 삼성 녹음 M4A의 전사 결과입니다. 전화 연결은 변경하지 않았습니다.");
            LabStore.log("SAMSUNG_REC_ASR_DONE","chars="+text.length()+"; file="+recordedFile);
        }catch(Throwable e){
            set("ERROR","완료 파일 전사 실패: "+e.getClass().getSimpleName()+": "+e.getMessage());
            LabStore.log("SAMSUNG_REC_ASR_ERROR",e.toString());
        }
    }
    private static void set(String p,String detail){phase=p;details=detail;}
}
