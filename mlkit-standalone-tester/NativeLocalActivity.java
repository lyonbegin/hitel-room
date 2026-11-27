package com.hitel.mlkit.tester;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.media.*;
import android.net.Uri;
import android.os.*;
import android.util.Log;
import android.widget.*;
import com.google.android.libraries.assistant.soda.Soda;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.*;

/** Experimental direct SODA route, in its own application process.
 * No SDK download call, no modification to Google app data, no system model registration.
 */
public final class NativeLocalActivity extends Activity implements Soda.Listener {
    static final String TAG="HITEL_SODA_LOCAL";
    static final String LIB="libgoogle_speech_sbg_tts_jni.so";
    static final String LIB_SHA="66bdb2fa005467676f4824258c8ed9301d711f6e8cdc15f053f4adc3460880ee";
    static final String KO_SHA="58deece081fd89ee928ba6bd705b6878be6bd395";
    static final String EN_SHA="f8745c8dbbdae1e77a9a9e7babfc78678b7bb2a";
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private volatile boolean busy=false, ready=false, stop=false;
    private volatile int finals=0;
    private volatile CountDownLatch stopLatch;
    private TextView output, status;
    private ScrollView scroll;
    private File modelDir, logFile;
    private String locale;
    private Soda soda;
    private long resources, handle;
    private Button pcm, mic, engine;
    private final Object logLock=new Object();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(12,36,12,12);
        root.setOnApplyWindowInsetsListener((v,insets)->{
            android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars());
            v.setPadding(bars.left+12,bars.top+12,bars.right+12,bars.bottom+12);return insets;
        });
        status=new TextView(this); status.setText("SODA Local — native experiment"); status.setTextSize(18); root.addView(status);
        Button choose=button(root,"로컬 모델 ZIP 선택",()->pick(10));
        engine=button(root,"원본 엔진 split APK 선택 (필요시)",()->pick(21));
        pcm=button(root,"PCM 파일 선택 및 STT",()->pick(20));
        mic=button(root,"마이크 STT",()->{
            if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)
                requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},30);
            else task("MIC",()->capture(null));
        });
        button(root,"STT 중지",()->stop=true);
        button(root,"전체 로컬 로그 복사",()->{
            try {
                String t=new String(java.nio.file.Files.readAllBytes(logFile.toPath()),StandardCharsets.UTF_8);
                getSystemService(ClipboardManager.class).setPrimaryClip(ClipData.newPlainText("SODA local",t));
                Toast.makeText(this,"복사 완료",Toast.LENGTH_SHORT).show();
            } catch(Exception e){ log("COPY_ERROR "+e); }
        });
        output=new TextView(this); output.setTextSize(11); output.setTextIsSelectable(true);
        scroll=new ScrollView(this); scroll.addView(output); root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(root);
        logFile=new File(getFilesDir(),"local-soda.log");
        pcm.setEnabled(false); mic.setEnabled(false);
        log("LOCAL_ACTIVITY_READY; direct JNI probe; model installation not claimed");
        Uri selected=getIntent().getData();
        if(selected!=null) task("IMPORT_AND_INIT",()->importAndInit(selected));
    }
    private Button button(LinearLayout root,String text,Runnable f){
        Button b=new Button(this); b.setText(text); b.setAllCaps(false); b.setOnClickListener(v->f.run()); root.addView(b); return b;
    }
    private void pick(int code) {
        if(busy){log("BUSY");return;}
        if(code==20&&!ready){log("NATIVE_NOT_READY");return;}
        Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        log("FILE_PICKER_ENTER code="+code);
        startActivityForResult(i,code);
    }
    @Override protected void onActivityResult(int code,int result,Intent data){
        super.onActivityResult(code,result,data);
        if(result!=RESULT_OK||data==null||data.getData()==null){log("FILE_PICKER_CANCELLED code="+code);return;}
        Uri u=data.getData();
        if(code==10)task("IMPORT_AND_INIT",()->importAndInit(u));
        else if(code==20)task("PCM",()->capture(u));
        else if(code==21)task("ENGINE_IMPORT",()->{
            if(modelDir==null)throw new IOException("Select and verify model first");
            File temp=new File(getCacheDir(),"selected-engine.apk");
            try {
                try(InputStream in=requireInput(u);OutputStream out=new FileOutputStream(temp)){copyBounded(in,out,200000000L);}
                File lib=extractVerifiedLibrary(temp);
                initialize(lib);
            } finally {temp.delete();}
        });
    }
    @Override public void onRequestPermissionsResult(int c,String[] p,int[] g){
        super.onRequestPermissionsResult(c,p,g);
        if(c==30&&g.length>0&&g[0]==PackageManager.PERMISSION_GRANTED)task("MIC",()->capture(null));
    }
    interface Work {void run()throws Exception;}
    private void task(String name,Work work){
        if(busy){log("BUSY "+name);return;}
        busy=true;stop=false;
        worker.execute(()->{
            log("TASK_ENTER "+name);
            try{work.run();}
            catch(Throwable e){log("TASK_ERROR "+name+" "+Log.getStackTraceString(e));}
            finally{busy=false;log("TASK_END "+name);}
        });
    }
    private void log(String s){
        String line=System.currentTimeMillis()+" +"+SystemClock.elapsedRealtime()+"ms "+s;
        Log.i(TAG,line);
        synchronized(logLock){
            if(logFile!=null)try(FileOutputStream f=new FileOutputStream(logFile,true)){
                f.write((line+"\n").getBytes(StandardCharsets.UTF_8));
                f.getFD().sync();
            }catch(IOException e){Log.e(TAG,"log persistence",e);}
        }
        runOnUiThread(()->{
            if(output!=null){output.append(line+"\n");scroll.post(()->scroll.fullScroll(ScrollView.FOCUS_DOWN));}
        });
    }
    private InputStream requireInput(Uri u)throws IOException{
        InputStream in=getContentResolver().openInputStream(u);
        if(in==null)throw new IOException("Cannot open selected document");return in;
    }
    private static long copyBounded(InputStream in,OutputStream out,long limit)throws IOException{
        long total=0;byte[] b=new byte[65536];int n;
        while((n=in.read(b))!=-1){total+=n;if(total>limit)throw new IOException("Size limit exceeded");out.write(b,0,n);}return total;
    }
    private static String hash(File f,String alg)throws Exception{
        MessageDigest d=MessageDigest.getInstance(alg);
        try(InputStream in=new FileInputStream(f)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)d.update(b,0,n);}
        StringBuilder s=new StringBuilder();for(byte b:d.digest())s.append(String.format(Locale.ROOT,"%02x",b&255));return s.toString();
    }
    private static void remove(File f){
        if(f.isDirectory()){File[] children=f.listFiles();if(children!=null)for(File c:children)remove(c);}
        f.delete();
    }
    private void importAndInit(Uri uri)throws Exception{
        closeSoda();modelDir=null;
        File zip=new File(getCacheDir(),"local-model-import.zip");
        File stage=new File(getFilesDir(),"local-soda-stage");
        remove(stage);if(!stage.mkdirs())throw new IOException("Cannot create stage");
        try{
            log("LOCAL_IMPORT_ENTER");
            long size;
            try(InputStream in=requireInput(uri);OutputStream out=new FileOutputStream(zip)){size=copyBounded(in,out,110000000L);}
            String digest=hash(zip,"SHA-1");
            log("LOCAL_ZIP bytes="+size+" sha1="+digest);
            long descriptorSize;
            if(KO_SHA.equals(digest)){locale="ko-KR";descriptorSize=93639000L;}
            else if(EN_SHA.equals(digest)){locale="en-US";descriptorSize=62065000L;}
            else throw new IOException("Model SHA-1 does not match verified v5072/v3072 packs");
            log("MODEL_SIZE_METADATA descriptor="+descriptorSize+" actual="+size+" delta="+(size-descriptorSize)+"; exact SHA-1 matched, proceed to ZIP extraction");
            log("MODEL_HASH_MATCH locale="+locale);
            long expanded=0;int entries=0;Set<String> names=new HashSet<>();
            try(ZipInputStream zis=new ZipInputStream(new BufferedInputStream(new FileInputStream(zip)))){
                ZipEntry z;
                String prefix=stage.getCanonicalPath()+File.separator;
                while((z=zis.getNextEntry())!=null){
                    if(++entries>8192)throw new IOException("Too many entries");
                    File dest=new File(stage,z.getName());String path=dest.getCanonicalPath();
                    if(!path.startsWith(prefix)||!names.add(path))throw new IOException("Unsafe or duplicate ZIP path");
                    if(z.isDirectory()){if(!dest.isDirectory()&&!dest.mkdirs())throw new IOException("mkdir failed");}
                    else{
                        File parent=dest.getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("mkdir failed");
                        long written;
                        try(OutputStream out=new FileOutputStream(dest)){written=copyBounded(zis,out,1500000000L-expanded);}
                        expanded+=written;
                        if(z.getSize()>=0&&z.getSize()!=written)throw new IOException("ZIP entry size mismatch");
                        if(entries<=40)log("ZIP_ENTRY "+z.getName()+" bytes="+written);
                    }
                    zis.closeEntry();
                }
            }
            if(entries==0||expanded==0)throw new IOException("Empty model");
            File base=new File(getFilesDir(),"local-soda-"+locale);
            remove(base);if(!stage.renameTo(base))throw new IOException("Cannot finalize local model");
            modelDir=base;
            File[] ls=base.listFiles();
            if(ls!=null&&ls.length==1&&ls[0].isDirectory())modelDir=ls[0];
            log("LOCAL_MODEL_EXTRACTED entries="+entries+" bytes="+expanded+" path="+modelDir.getAbsolutePath()+"; not Google model registration");
            File lib=findInstalledLibrary();
            initialize(lib);
        }finally{zip.delete();remove(stage);}
    }
    private File extractVerifiedLibrary(File apk)throws Exception{
        try(ZipFile z=new ZipFile(apk)){
            ZipEntry e=z.getEntry("lib/arm64-v8a/"+LIB);
            if(e==null)throw new IOException("Original ARM64 library not in "+apk.getName());
            try(InputStream in=z.getInputStream(e)){return saveVerifiedLibrary(in);}
        }
    }
    private File saveVerifiedLibrary(InputStream in)throws Exception{
        File dir=new File(getFilesDir(),"local-soda-engine");if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("mkdir failed");
        File lib=new File(dir,LIB),tmp=new File(dir,LIB+".tmp");tmp.delete();
        try{
            try(OutputStream out=new FileOutputStream(tmp)){copyBounded(in,out,60000000L);}
            String digest=hash(tmp,"SHA-256");log("NATIVE_LIBRARY_SHA256="+digest);
            if(!LIB_SHA.equals(digest))throw new IOException("Engine version/hash differs from the analyzed original APK");
            if(lib.exists()&&!lib.delete())throw new IOException("Cannot replace verified library");
            if(!tmp.renameTo(lib)||!lib.setReadOnly())throw new IOException("Cannot finalize read-only library");
            return lib;
        }finally{tmp.delete();}
    }
    private File findInstalledLibrary()throws Exception{
        if(!Arrays.asList(Build.SUPPORTED_ABIS).contains("arm64-v8a"))throw new IOException("Original engine needs arm64-v8a");
        ApplicationInfo a=getPackageManager().getApplicationInfo("com.google.android.tts",0);
        File direct=new File(a.nativeLibraryDir,LIB);
        log("ORIGINAL_PACKAGE_NATIVE_PATH="+direct+" readable="+direct.canRead());
        if(direct.canRead()){
            try(InputStream in=new FileInputStream(direct)){return saveVerifiedLibrary(in);}
        }
        List<String> paths=new ArrayList<>();paths.add(a.sourceDir);if(a.splitSourceDirs!=null)paths.addAll(Arrays.asList(a.splitSourceDirs));
        for(String p:paths){
            try(ZipFile z=new ZipFile(p)){
                ZipEntry e=z.getEntry("lib/arm64-v8a/"+LIB);
                if(e!=null){log("ORIGINAL_ENGINE_APK_ENTRY="+new File(p).getName());try(InputStream in=z.getInputStream(e)){return saveVerifiedLibrary(in);}}
            }catch(IOException e){log("APK_ENTRY_READ "+new File(p).getName()+" "+e.getMessage());}
        }
        throw new IOException("Exact original library unavailable; select the supplied original ARM64 split APK");
    }
    private void initialize(File lib)throws Exception{
        closeSoda();
        log("NATIVE_LIBRARY_LOAD_ENTER "+lib.getAbsolutePath());
        Soda.load(lib.getAbsolutePath());
        log("NATIVE_LIBRARY_LOAD_RETURN");
        soda=new Soda(this);
        log("NATIVE_CREATE_RESOURCES_ENTER");
        resources=Soda.nativeCreateSharedResources(soda);
        log("NATIVE_CREATE_RESOURCES_RETURN nonzero="+(resources!=0));
        if(resources==0)throw new IOException("Native shared resource creation failed");
        log("NATIVE_CONSTRUCT_ENTER");
        handle=soda.nativeConstruct(resources);
        log("NATIVE_CONSTRUCT_RETURN nonzero="+(handle!=0));
        if(handle==0)throw new IOException("Native construction failed");
        // Candidate minimal config reconstructed from the original Android protobuf wire descriptors.
        // oxd.1=owm, oxd.3=oxb, oxd.6=owx, oxd.9=oug.
        // oxb.13 is the absolute LP path assigned from ConversationSession.startSodaCapture p2.
        byte[] audio=pb(v(2,1),v(3,16000),v(4,1));
        byte[] core=pb(b(1,pb(b(1,audio),b(2,audio))),
            b(3,pb(v(1,1),b(13,modelDir.getAbsolutePath().getBytes(StandardCharsets.UTF_8)),v(18,4),v(20,1),b(48,v(1,0)),v(999,1))),
            b(6,b(1,locale.getBytes(StandardCharsets.UTF_8))),b(9,v(2,1)));
        log("NATIVE_INIT_ENTER path="+modelDir+" configBytes="+core.length+" mode=AMBIENT_CONTINUOUS; candidate Android config raw="+hex(core));
        byte[] result=soda.nativeInit(handle,core);
        if(result==null)throw new IOException("Native init returned null");
        long code=number(result,1,0);String msg=firstText(result,2);
        log("NATIVE_INIT_RETURN code="+code+" message="+msg+" raw="+hex(result));
        if(code!=0)throw new IOException("Native init error "+code+" "+msg);
        ready=true;runOnUiThread(()->{status.setText("Native init returned NO_ERROR; STT test required");pcm.setEnabled(true);mic.setEnabled(true);});
        log("NATIVE_INIT_NO_ERROR; recognition still unverified");
    }
    private void capture(Uri uri)throws Exception{
        if(!ready||soda==null||handle==0)throw new IOException("Native model not initialized");
        finals=0;stopLatch=new CountDownLatch(1);
        AudioRecord rec=null;InputStream in=null;
        boolean started=false;
        try{
            if(uri==null){
                int min=AudioRecord.getMinBufferSize(16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT);
                rec=new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION,16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,Math.max(4096,min));
                if(rec.getState()!=AudioRecord.STATE_INITIALIZED)throw new IOException("AudioRecord init failed");
            }else in=new BufferedInputStream(requireInput(uri));
            // Original hee.getStreamingSodaConfig(): Lozu.5 -> Lozs.1 -> Lozt.
            // Lozt.1=0, .2=2, .4=Louk(INT16,16000,1), .8=0;
            // Lozu.2=true, .3=false, .9=0. Retain ConversationSession field102.
            byte[] format=pb(v(2,1),v(3,16000),v(4,1));
            byte[] streaming=pb(v(1,0),v(2,2),b(4,format),v(8,0));
            byte[] captureConfig=pb(v(2,1),v(3,0),b(5,b(1,streaming)),v(9,0),v(102,1));
            log("NATIVE_START_CAPTURE_ENTER source="+(uri==null?"MIC":"PCM_FILE")+" format=INT16/16000/1 streamingConfig="+hex(captureConfig));
            byte[] result=soda.nativeStartCapture(handle,captureConfig);
            if(result==null)throw new IOException("Native start returned null");
            long code=number(result,1,0);
            log("NATIVE_START_CAPTURE_RETURN code="+code+" message="+firstText(result,2)+" raw="+hex(result));
            if(code!=0)throw new IOException("Native capture rejected");
            started=true;
            if(rec!=null){
                rec.startRecording();
                log("AUDIO_RECORD_STARTED state="+rec.getRecordingState()+" sampleRate="+rec.getSampleRate()+" channels="+rec.getChannelCount()+" encoding="+rec.getAudioFormat());
                if(rec.getRecordingState()!=AudioRecord.RECORDSTATE_RECORDING)throw new IOException("AudioRecord failed to enter recording state");
            }
            byte[] chunk=new byte[1024];ByteBuffer direct=ByteBuffer.allocateDirect(1024).order(java.nio.ByteOrder.LITTLE_ENDIAN);
            long start=SystemClock.elapsedRealtime(),bytes=0,chunks=0,accepted=0,rejected=0,attempts=0; int consecutiveReject=0;
            while(!stop&&(SystemClock.elapsedRealtime()-start)<120000){
                int n=0;
                while(n<chunk.length&&!stop){
                    int r=rec!=null?rec.read(chunk,n,chunk.length-n):in.read(chunk,n,chunk.length-n);
                    if(r<0){if(rec!=null)throw new IOException("AudioRecord read "+r);break;}
                    if(r==0)break;n+=r;
                }
                if(n==0)break;
                if((n&1)!=0)throw new IOException("Odd PCM byte count");
                if(uri!=null&&chunks==0&&n>=12&&((chunk[0]=='R'&&chunk[1]=='I'&&chunk[2]=='F'&&chunk[3]=='F')||(chunk[4]=='f'&&chunk[5]=='t'&&chunk[6]=='y'&&chunk[7]=='p')))throw new IOException("Select raw PCM16, not WAV/M4A");
                if(uri!=null){long wait=start+bytes/32-SystemClock.elapsedRealtime();if(wait>0)Thread.sleep(wait);}
                direct.clear();direct.put(chunk,0,n);direct.flip();
                attempts++;
                if(attempts<=3||attempts%32==0){
                    int peak=0;long square=0;
                    for(int i=0;i<n;i+=2){int sample=(short)((chunk[i]&255)|(chunk[i+1]<<8));peak=Math.max(peak,Math.abs(sample));square+=(long)sample*sample;}
                    log("PCM_READ attempt="+attempts+" bytes="+n+" samples="+(n/2)+" peak="+peak+" rms="+Math.sqrt((double)square/(n/2))+" direct="+direct.isDirect()+" position="+direct.position()+" limit="+direct.limit());
                }
                long callStart=SystemClock.elapsedRealtime();
                // Actual NGSA ConversationSession: fqq MicAudio (kxl) -> lei(1,3,oui)
                // -> lex -> lfa.i -> Soda.u -> nativePushAudio(handle,0,0,proto,len,-1000).
                // oui.1 is raw bytes; oui.2 is Louk sample format/rate/channel count.
                byte[] packet=pb(b(1,java.util.Arrays.copyOf(chunk,n)),b(2,format));
                ByteBuffer wire=ByteBuffer.allocateDirect(packet.length);
                wire.put(packet); // original Soda.u writes bytes, native obtains base address
                byte[] pushResult=soda.nativePushAudio(handle,0,0,wire,packet.length,-1000);
                if(pushResult==null)throw new IOException("nativePushAudio returned null");
                long pushCode=number(pushResult,1,0);
                boolean ok=pushCode==0;
                if(attempts<=3||!ok||attempts%32==0)log("NATIVE_PUSH_AUDIO_RETURN source=0 action=0 packetBytes="+packet.length+" timeoutMs=-1000 code="+pushCode+" message="+firstText(pushResult,2)+" raw="+hex(pushResult));
                bytes+=n;chunks++;
                if(ok){accepted+=n;consecutiveReject=0;}
                else{rejected+=n;consecutiveReject++;log("NATIVE_PCM_REJECT attempt="+attempts+" bytes="+n+" elapsedMs="+(SystemClock.elapsedRealtime()-callStart)+" consecutive="+consecutiveReject);}
                if(attempts<=3||attempts%32==0)log("NATIVE_PCM_FEED attempt="+attempts+" result="+ok+" readBytes="+bytes+" acceptedBytes="+accepted+" rejectedBytes="+rejected);
                if(consecutiveReject>=8)throw new IOException("nativePushAudio rejected 8 consecutive chunks; inspect returned status and native events");
                if(uri!=null&&n<chunk.length)break;
            }
            log("PCM_INPUT_END readBytes="+bytes+" chunks="+chunks+" acceptedBytes="+accepted+" rejectedBytes="+rejected);
        }finally{
            if(rec!=null){try{rec.stop();}catch(Exception ignored){}rec.release();}
            if(in!=null)in.close();
            if(started){log("NATIVE_STOP_CAPTURE_ENTER");soda.nativeStopCapture(handle);log("NATIVE_STOP_CAPTURE_RETURN");boolean stopped=stopLatch.await(5,TimeUnit.SECONDS);log("CAPTURE_END callback="+stopped+" finalCount="+finals);}
        }
    }
    private void closeSoda(){
        ready=false;runOnUiThread(()->{if(pcm!=null)pcm.setEnabled(false);if(mic!=null)mic.setEnabled(false);});
        Soda s=soda;soda=null;
        try{if(s!=null&&handle!=0)s.nativeDelete(handle);}catch(Throwable e){log("NATIVE_DELETE_ERROR "+e);}finally{handle=0;}
        try{if(s!=null&&resources!=0)Soda.nativeDeleteSharedResources(s,resources);}catch(Throwable e){log("NATIVE_RESOURCES_DELETE_ERROR "+e);}finally{resources=0;}
    }
    @Override public void signal(String name,int value){log(name+" value="+value);if(name.equals("HANDLE_STOP")||name.equals("HANDLE_SHUTDOWN")){CountDownLatch l=stopLatch;if(l!=null)l.countDown();}}
    @Override public void event(byte[] raw){
        try{
            // Actual original ConversationSession: oym field2 is recognition event; oyk case2 partial, case1 final.
            for(Field r:parse(raw))if(r.id==2&&r.data!=null){
                for(Field h:parse(r.data))if((h.id==1||h.id==2||h.id==4)&&h.data!=null){
                    String text=firstText(h.data,1);
                    if(!text.isEmpty()){if(h.id==1)finals++;log((h.id==1?"FINAL":h.id==2?"PARTIAL":"PREFETCH")+"="+text);}
                }
            }
            log("NATIVE_EVENT bytes="+raw.length+" raw="+hex(raw));
        }catch(Throwable e){log("EVENT_PARSE_ERROR "+e+" raw="+hex(raw));}
    }
    private static String hex(byte[] bytes){StringBuilder s=new StringBuilder();for(int i=0;i<Math.min(bytes.length,256);i++)s.append(String.format(Locale.ROOT,"%02x",bytes[i]&255));return s.toString();}
    private static void var(ByteArrayOutputStream out,long value){while((value&~127L)!=0){out.write((int)(value&127)|128);value>>>=7;}out.write((int)value);}
    private static byte[] v(int field,long value){ByteArrayOutputStream o=new ByteArrayOutputStream();var(o,((long)field)<<3);var(o,value);return o.toByteArray();}
    private static byte[] b(int field,byte[] bytes){ByteArrayOutputStream o=new ByteArrayOutputStream();var(o,(((long)field)<<3)|2);var(o,bytes.length);o.write(bytes,0,bytes.length);return o.toByteArray();}
    private static byte[] pb(byte[]... fields){ByteArrayOutputStream o=new ByteArrayOutputStream();for(byte[] f:fields)o.write(f,0,f.length);return o.toByteArray();}
    private static long readVar(byte[] a,int[] p)throws IOException{long r=0;for(int i=0;i<64;i+=7){if(p[0]>=a.length)throw new IOException("truncated proto");int b=a[p[0]++]&255;r|=((long)(b&127))<<i;if((b&128)==0)return r;}throw new IOException("invalid varint");}
    private static final class Field{int id;long value;byte[] data;Field(int i){id=i;}}
    private static List<Field> parse(byte[] a)throws IOException{
        List<Field> out=new ArrayList<>();int[] p={0};
        while(p[0]<a.length){
            long key=readVar(a,p);int id=(int)(key>>>3),wire=(int)(key&7);if(id==0)throw new IOException("invalid field");
            Field f=new Field(id);
            if(wire==0)f.value=readVar(a,p);
            else if(wire==2){long n=readVar(a,p);if(n<0||n>a.length-p[0])throw new IOException("invalid length");f.data=Arrays.copyOfRange(a,p[0],p[0]+(int)n);p[0]+=(int)n;}
            else if(wire==1||wire==5){int n=wire==1?8:4;if(n>a.length-p[0])throw new IOException("truncated fixed");p[0]+=n;}
            else throw new IOException("unsupported wire "+wire);
            out.add(f);
        }return out;
    }
    private static long number(byte[] a,int id,long def)throws IOException{for(Field f:parse(a))if(f.id==id&&f.data==null)return f.value;return def;}
    private static String firstText(byte[] a,int id)throws IOException{for(Field f:parse(a))if(f.id==id&&f.data!=null)return new String(f.data,StandardCharsets.UTF_8);return "";}
    @Override protected void onDestroy(){stop=true;worker.execute(this::closeSoda);worker.shutdown();super.onDestroy();}
}
