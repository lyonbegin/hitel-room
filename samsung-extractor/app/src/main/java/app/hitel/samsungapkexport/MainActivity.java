package app.hitel.samsungapkexport;

import android.app.Activity;
import android.content.*;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.provider.MediaStore;
import android.content.ContentValues;
import android.widget.*;
import java.io.*;
import java.util.*;
import java.util.zip.*;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;

public class MainActivity extends Activity {
    private final String[] packages = {
        "com.samsung.android.incallui",
        "com.samsung.android.dialer"
    };
    private TextView console;
    private Uri lastZip;
    private String lastName;
    private void log(String message) {
        console.append(message + "\n");
    }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(22, 24, 22, 18);
        TextView title = new TextView(this);
        title.setText("삼성 전화 앱 원본 APK 추출");
        title.setTextSize(23);
        content.addView(title);
        TextView message = new TextView(this);
        message.setText("설치된 InCallUI 및 Dialer의 실제 APK를 ZIP에 복사합니다.\n전화 앱 업데이트·삭제·권한 변경은 하지 않습니다.");
        content.addView(message);
        Button export = new Button(this);
        export.setText("1. 원본 두 APK 추출하여 다운로드에 저장");
        export.setAllCaps(false);
        content.addView(export);
        Button share = new Button(this);
        share.setText("2. 생성된 ZIP 파일 공유");
        share.setEnabled(false);
        share.setAllCaps(false);
        content.addView(share);
        ScrollView sc = new ScrollView(this);
        console = new TextView(this);
        console.setTextIsSelectable(true);
        sc.addView(console);
        content.addView(sc, new LinearLayout.LayoutParams(-1,0,1f));
        setContentView(content);
        log(Build.MANUFACTURER+" "+Build.MODEL+" Android "+Build.VERSION.RELEASE);
        log("원본 APK 버전: 기기에 설치된 버전을 그대로 추출합니다.");
        export.setOnClickListener(v -> {
            export.setEnabled(false);
            share.setEnabled(false);
            log("원본 추출 시작");
            new Thread(() -> {
                try {
                    Uri file = makeZip();
                    runOnUiThread(() -> {
                        lastZip = file;
                        log("추출 완료: 다운로드/"+lastName);
                        share.setEnabled(true);
                        export.setEnabled(true);
                    });
                } catch(Exception e) {
                    runOnUiThread(() -> {
                        log("추출 실패: "+e.getClass().getSimpleName()+": "+e.getMessage());
                        export.setEnabled(true);
                    });
                }
            }).start();
        });
        share.setOnClickListener(v->shareZip());
    }
    @SuppressWarnings("deprecation")
    private Uri makeZip() throws Exception {
        String name = "Samsung_InCallUI_Dialer_Originals_"+new SimpleDateFormat("yyyyMMdd_HHmmss",Locale.US).format(new Date())+".zip";
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME,name);
        values.put(MediaStore.Downloads.MIME_TYPE,"application/zip");
        values.put(MediaStore.Downloads.IS_PENDING,1);
        Uri item = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if(item==null) throw new IOException("Downloads 저장소 생성 실패");
        int successes=0;
        try {
            try(OutputStream stream=getContentResolver().openOutputStream(item);
                ZipOutputStream zip=new ZipOutputStream(stream)){
                byte[] buffer=new byte[65536];
                StringBuilder note=new StringBuilder();
                note.append("Samsung APK Extraction\n")
                    .append("Device: ").append(Build.MANUFACTURER).append(' ')
                    .append(Build.MODEL).append(" Android ").append(Build.VERSION.RELEASE).append('\n');
                for(String pkg:packages){
                    try {
                        PackageManager pm=getPackageManager();
                        ApplicationInfo ai=pm.getApplicationInfo(pkg,0);
                        PackageInfo pi=pm.getPackageInfo(pkg,0);
                        note.append("Package: ").append(pkg).append(" Version: ").append(pi.versionName).append('\n');
                        ArrayList<String> paths=new ArrayList<>();
                        paths.add(ai.sourceDir);
                        if(ai.splitSourceDirs!=null) Collections.addAll(paths,ai.splitSourceDirs);
                        for(int i=0;i<paths.size();i++){
                            String path=paths.get(i);
                            String filename=path.substring(path.lastIndexOf('/')+1);
                            String entryName=pkg+"/"+i+"_"+filename;
                            try(InputStream input=new FileInputStream(path)){
                                MessageDigest dig=MessageDigest.getInstance("SHA-256");
                                zip.putNextEntry(new ZipEntry(entryName));
                                int n; long len=0;
                                while((n=input.read(buffer))!=-1){
                                    zip.write(buffer,0,n);
                                    dig.update(buffer,0,n);
                                    len+=n;
                                }
                                zip.closeEntry();
                                successes++;
                                note.append("  ").append(entryName)
                                  .append(" bytes=").append(len)
                                  .append(" sha256=").append(hex(dig.digest())).append('\n');
                            }catch(Exception e){
                                note.append("ERROR reading ").append(path).append(": ").append(e).append('\n');
                            }
                        }
                    }catch(Exception e) {
                        note.append("ERROR package ").append(pkg).append(": ").append(e).append('\n');
                    }
                }
                zip.putNextEntry(new ZipEntry("EXTRACTION_REPORT.txt"));
                zip.write(note.toString().getBytes("UTF-8"));
                zip.closeEntry();
                if(successes == 0) throw new IOException("원본 APK에 접근하지 못했습니다. 전부 실패했습니다.");
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING,0);
            getContentResolver().update(item, values, null, null);
            lastName=name;
            return item;
        }catch(Exception e){
            getContentResolver().delete(item,null,null);
            throw e;
        }
    }
    private static String hex(byte[] bytes){
        StringBuilder b=new StringBuilder();
        for(byte v:bytes)b.append(String.format(Locale.US,"%02x",v&255));
        return b.toString();
    }
    private void shareZip(){
        if(lastZip==null) return;
        Intent intent=new Intent(Intent.ACTION_SEND);
        intent.setType("application/zip");
        intent.putExtra(Intent.EXTRA_STREAM,lastZip);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try{startActivity(Intent.createChooser(intent,"삼성 원본 APK ZIP 공유"));}
        catch(Exception e){log("공유 오류: "+e.getMessage());}
    }
}
