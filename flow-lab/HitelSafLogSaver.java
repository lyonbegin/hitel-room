package app.hitel.samsungprobe;

import android.content.Context;
import android.content.ContentResolver;
import android.net.Uri;
import android.os.Build;
import androidx.documentfile.provider.DocumentFile;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Date;
import java.text.SimpleDateFormat;

/**
 * User-selectable SAF log folder: stores a plain UTF-8 log even when STT is down.
 * A write is NOT reported as successful until the saved file is reopened
 * and a byte-for-byte SHA-256 digest matches. Does not rely on Downloads API.
 */
public final class HitelSafLogSaver {
    static final String PREFS="hitel_manual_log_folder";
    static final String KEY_URI="tree_uri";
    static final String FILE_NAME="HITEL14_latest_log.txt";
    private static final int MAX_SOURCE_BYTES=2*1024*1024;
    private HitelSafLogSaver(){}

    public static final class Verified {
        public final String name;
        public final long bytes;
        public final String uri;
        Verified(String n,long b,String u){name=n;bytes=b;uri=u;}
        public String summary(){return name+" · "+bytes+"바이트 · 읽기 검증 완료";}
    }

    public static Uri selectedFolder(Context c){
        String raw=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getString(KEY_URI,null);
        return raw==null||raw.isEmpty()?null:Uri.parse(raw);
    }

    public static void storeFolder(Context c,Uri uri) throws IOException {
        DocumentFile folder=DocumentFile.fromTreeUri(c,uri);
        if(folder==null||!folder.isDirectory()||!folder.canWrite())
            throw new IOException("선택한 폴더에 쓰기 권한이 없습니다.");
        if(!c.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit()
            .putString(KEY_URI,uri.toString()).commit())
            throw new IOException("선택한 폴더 설정 저장에 실패했습니다.");
    }

    private static void section(StringBuilder s,String title,String content){
        s.append("\n========== ").append(title).append(" ==========\n");
        s.append(content==null||content.isEmpty()?"(기록 없음)\n":content+"\n");
    }

    private static String tail(File file)throws IOException {
        if(file==null||!file.isFile())return "(해당 로그 파일 없음)";
        long total=file.length();
        if(total<=0)return "(빈 로그 파일)";
        long from=Math.max(0,total-MAX_SOURCE_BYTES);
        try(FileInputStream in=new FileInputStream(file);
            ByteArrayOutputStream out=new ByteArrayOutputStream((int)Math.min(total,MAX_SOURCE_BYTES))){
            long skipped=0;
            while(skipped<from){
                long n=in.skip(from-skipped);
                if(n<=0){if(in.read()<0)break;n=1;}
                skipped+=n;
            }
            byte[] buffer=new byte[16384];int count;
            while((count=in.read(buffer))!=-1){
                if(count>0)out.write(buffer,0,count);
            }
            return (from>0?"[오래된 "+from+"바이트 생략 · 마지막 2MB]\n":"")+
                    out.toString("UTF-8");
        }
    }

    private static void diagnosticRuns(Context c,StringBuilder data)throws IOException{
        File root=new File(c.getFilesDir(),"diagnostics");
        File[] runs=root.listFiles(f->f.isDirectory()&&f.getName().startsWith("run-"));
        if(runs==null||runs.length==0){
            section(data,"DIRECT STT DIAGNOSTICS","(세션 디렉터리 없음)");
            return;
        }
        Arrays.sort(runs,Comparator.comparingLong(File::lastModified).reversed());
        for(int i=0;i<Math.min(8,runs.length);i++){
            File dir=runs[i];
            section(data,dir.getName()+"/events.jsonl",
                    tail(new File(dir,"events.jsonl")));
            section(data,dir.getName()+"/latency-trace.jsonl",
                    tail(new File(dir,"latency-trace.jsonl")));
        }
    }

    private static String buildText(Context c,List<String> screenLogs)throws IOException{
        StringBuilder s=new StringBuilder(512*1024);
        String when=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS",Locale.KOREA)
            .format(new Date());
        s.append("HITEL14-MANUAL-LOG\n")
            .append("savedAt=").append(when).append("\n")
            .append("appId=").append(c.getPackageName()).append("\n")
            .append("device=").append(Build.MANUFACTURER).append("/")
              .append(Build.MODEL).append("\n")
            .append("sdk=").append(Build.VERSION.SDK_INT).append("\n");
        section(s,"DIRECT STT CURRENT SERVICE STATE",
            c.getSharedPreferences("hitel_direct_stt",Context.MODE_PRIVATE)
                .getString("status","(서비스 상태 기록 없음)"));
        section(s,"SPEAKER / DIRECT STT EVENTS",
            tail(new File(c.getFilesDir(),"speaker-capture-events.log")));
        section(s,"PREVIOUS SPEAKER EVENTS",
            tail(new File(c.getFilesDir(),"speaker-capture-events.log.previous")));
        try{
            section(s,"W03 / MICROPHONE / OUTPUT STT EVENTS",
                tail(LabStore.logFile(c)));
        }catch(Throwable t){
            section(s,"W03 LOG READ ERROR",t.toString());
        }
        diagnosticRuns(c,s);
        if(screenLogs!=null){
            StringBuilder visible=new StringBuilder();
            int start=Math.max(0,screenLogs.size()-500);
            for(int i=start;i<screenLogs.size();i++)
                visible.append(screenLogs.get(i)).append("\n");
            section(s,"W03 VISIBLE LOG ENTRIES",visible.toString());
        }
        return s.toString();
    }

    private static byte[] sha(byte[] bytes)throws IOException{
        try{return MessageDigest.getInstance("SHA-256").digest(bytes);}
        catch(Exception ex){throw new IOException("SHA-256 계산 실패",ex);}
    }

    public static Verified save(Context c,List<String> screenLogs)throws IOException {
        SpeakerCaptureLog.append(c,"MANUAL_LOG_SAVE_ATTEMPT",
            "user-chosen SAF folder, do not require running STT");
        Uri tree=selectedFolder(c);
        if(tree==null)throw new IOException("로그 저장 폴더를 먼저 선택하십시오.");
        DocumentFile folder=DocumentFile.fromTreeUri(c,tree);
        if(folder==null||!folder.isDirectory()||!folder.canWrite())
            throw new IOException("로그 폴더 접근 불가 · 다시 선택해 주십시오.");
        byte[] payload=buildText(c,screenLogs).getBytes(StandardCharsets.UTF_8);
        if(payload.length<40)throw new IOException("로그 내용 생성 실패");
        DocumentFile file=folder.findFile(FILE_NAME);
        if(file==null)file=folder.createFile("text/plain",FILE_NAME);
        if(file==null||!file.isFile())
            throw new IOException("저장 폴더 안에 TXT 파일 생성 실패");
        ContentResolver resolver=c.getContentResolver();
        try(OutputStream out=resolver.openOutputStream(file.getUri(),"wt")){
            if(out==null)throw new IOException("저장 파일 열기 실패");
            out.write(payload);
            out.flush();
        }catch(Exception ex){
            throw new IOException("로그 파일 쓰기 실패: "+ex.getMessage(),ex);
        }
        long actual=0;
        byte[] expected=sha(payload);
        byte[] observed;
        try{
            MessageDigest digest=MessageDigest.getInstance("SHA-256");
            try(InputStream input=resolver.openInputStream(file.getUri())){
                if(input==null)throw new IOException("저장 파일 다시 열기 실패");
                byte[] buffer=new byte[16384];int n;
                while((n=input.read(buffer))!=-1){
                    if(n>0){digest.update(buffer,0,n);actual+=n;}
                }
            }
            observed=digest.digest();
        }catch(Exception ex){throw new IOException("저장 파일 검증 실패: "+ex.getMessage(),ex);}
        if(actual!=payload.length||!Arrays.equals(expected,observed))
            throw new IOException("저장한 로그의 실제 내용이 다릅니다. 확인 "+actual+
                "바이트 / 예상 "+payload.length+"바이트");
        SpeakerCaptureLog.append(c,"MANUAL_LOG_SAVE_VERIFIED",
            "uri="+file.getUri()+"; bytes="+actual);
        return new Verified(file.getName(),actual,file.getUri().toString());
    }
}
