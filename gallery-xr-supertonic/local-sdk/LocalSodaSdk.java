package com.hitel.soda.sdk;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import com.google.android.libraries.assistant.soda.Soda;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.*;

/** Local SODA SDK: extracted from the real-device verified JNI probe, with UI removed.
 * Original Google engine is read from the installed Speech Services, never redistributed.
 * Local pack imports and engine state are private to this application.
 */
public final class LocalSodaSdk implements Soda.Listener, AutoCloseable {
    static final String TAG="HITEL_SODA_LOCAL";
    static final String LIB="libgoogle_speech_sbg_tts_jni.so";
    static final String LIB_SHA="66bdb2fa005467676f4824258c8ed9301d711f6e8cdc15f053f4adc3460880ee";
    static final String KO_SHA="58deece081fd89ee928ba6bd705b6878be6bd395";
    static final String EN_SHA="f8745c8dbbdae1e77a9a9e7babfc78678b7bb2a";

    public interface TranscriptListener { void text(String text, boolean isFinal); }
    private final Context context;
    private final TranscriptListener listener;
    private volatile boolean ready;
    private volatile int finals;
    private volatile CountDownLatch stopLatch;
    private File modelDir;
    private String locale;
    private Soda soda;
    private long resources, handle;
    public LocalSodaSdk(Context context, TranscriptListener listener){
        this.context=context.getApplicationContext();this.listener=listener;
    }
    public static boolean supportsLocale(String locale){return "ko-KR".equals(locale)||"en-US".equals(locale);}
    public static boolean supportsDevice(){return Arrays.asList(Build.SUPPORTED_ABIS).contains("arm64-v8a");}
    public static boolean installed(Context context,String locale){
        if(!supportsLocale(locale)||!supportsDevice())return false;
        File base=new File(context.getFilesDir(),"local-soda-"+locale);
        File marker=new File(base,".verified");
        if(!marker.isFile())return false;
        try{return new String(java.nio.file.Files.readAllBytes(marker.toPath()),StandardCharsets.US_ASCII).equals("ko-KR".equals(locale)?KO_SHA:EN_SHA);}
        catch(IOException e){return false;}
    }
    public static boolean anyInstalled(Context context){return installed(context,"ko-KR")||installed(context,"en-US");}
    private void log(String s){Log.i(TAG,s);}
    public synchronized void prepare(String tag)throws Exception{
        if(!installed(context,tag))throw new IOException("Select verified local SODA ZIP for "+tag);
        locale=tag;modelDir=new File(context.getFilesDir(),"local-soda-"+tag);
        File[] dirs=modelDir.listFiles(f->f.isDirectory());
        if(dirs!=null&&dirs.length==1&&!new File(modelDir,"configs").isDirectory())modelDir=dirs[0];
        initialize(findInstalledLibrary());
    }
    public synchronized void start()throws Exception{
        if(!ready||handle==0)throw new IOException("Native model not initialized");
        finals=0;stopLatch=new CountDownLatch(1);
        byte[] format=pb(v(2,1),v(3,16000),v(4,1));
        byte[] streaming=pb(v(1,0),v(2,2),b(4,format),v(8,0));
        byte[] config=pb(v(2,1),v(3,0),b(5,b(1,streaming)),v(9,0),v(102,1));
        byte[] result=soda.nativeStartCapture(handle,config);
        if(result==null||number(result,1,0)!=0)throw new IOException("Native start failed");
        log("LOCAL_SDK_CAPTURE_START locale="+locale);
    }
    public synchronized void push(byte[] pcm,int n)throws Exception{
        if(n<=0||n>pcm.length||(n&1)!=0)throw new IOException("Invalid PCM16 byte count");
        byte[] format=pb(v(2,1),v(3,16000),v(4,1));
        byte[] packet=pb(b(1,Arrays.copyOf(pcm,n)),b(2,format));
        ByteBuffer wire=ByteBuffer.allocateDirect(packet.length);wire.put(packet);
        byte[] ret=soda.nativePushAudio(handle,0,0,wire,packet.length,-1000);
        if(ret==null||number(ret,1,0)!=0)throw new IOException("Native push rejected: "+(ret==null?"null":hex(ret)));
    }
    public void finish()throws Exception{
        synchronized(this){if(soda==null||handle==0)return;soda.nativeStopCapture(handle);}
        CountDownLatch latch=stopLatch;boolean ended=latch!=null&&latch.await(5,TimeUnit.SECONDS);
        log("LOCAL_SDK_CAPTURE_END callback="+ended+" nativeFinals="+finals);
    }
    @Override public void close(){closeSoda();}
    private InputStream requireInput(Uri u)throws IOException{
        InputStream in=context.getContentResolver().openInputStream(u);
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
    public synchronized String importModel(Uri uri)throws Exception{
        closeSoda();modelDir=null;
        File zip=File.createTempFile("soda-import-",".zip",context.getCacheDir());
        File stage=new File(context.getFilesDir(),"local-soda-stage-"+UUID.randomUUID());
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

                    }
                    zis.closeEntry();
                }
            }
            if(entries==0||expanded==0)throw new IOException("Empty model");
            File base=new File(context.getFilesDir(),"local-soda-"+locale);
            if(!base.exists()&&!stage.renameTo(base))throw new IOException("Cannot finalize local model");
            modelDir=base;
            File[] ls=base.listFiles();
            if(ls!=null&&ls.length==1&&ls[0].isDirectory())modelDir=ls[0];
            log("LOCAL_MODEL_EXTRACTED entries="+entries+" bytes="+expanded+" path="+modelDir.getAbsolutePath()+"; not Google model registration");
            File lib=findInstalledLibrary();
            initialize(lib);
            File marker=new File(base,".verified");
            try(FileOutputStream out=new FileOutputStream(marker)){out.write(digest.getBytes(StandardCharsets.US_ASCII));out.getFD().sync();}
            log("LOCAL_IMPORT_READY locale="+locale);
            return locale;
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
        File dir=new File(context.getFilesDir(),"local-soda-engine");if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("mkdir failed");
        File lib=new File(dir,LIB),tmp=File.createTempFile("engine-",".tmp",dir);
        if(lib.isFile()&&LIB_SHA.equals(hash(lib,"SHA-256"))){tmp.delete();return lib;}
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
        ApplicationInfo a=context.getPackageManager().getApplicationInfo("com.google.android.tts",0);
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
        ready=true;
        log("NATIVE_INIT_NO_ERROR");
    }
    public synchronized void closeSoda(){
        ready=false;
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
                    if(!text.isEmpty()&&(h.id==1||h.id==2)){if(h.id==1)finals++;listener.text(text,h.id==1);log((h.id==1?"FINAL":"PARTIAL")+"="+text);}
                }
            }
            // Do not log raw PCM/audio-level telemetry.
        }catch(Throwable e){log("EVENT_PARSE_ERROR "+e);}
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

}
