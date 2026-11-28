package app.hitel.speakeronly;

import android.content.Context;
import android.os.Build;
import android.os.SystemClock;
import io.github.muntashirakon.adb.AbsAdbConnectionManager;
import io.github.muntashirakon.adb.AdbStream;
import io.github.muntashirakon.adb.android.AdbMdns;
import java.io.*;
import java.net.*;
import java.math.BigInteger;
import java.security.*;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Date;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.conscrypt.Conscrypt;

/** Embedded, user-authorized local ADB bootstrap; never asks a PC or opens a legacy TCP debug port. */
final class CallTxBootstrap {
  private static final String LOCAL="127.0.0.1";
  private final Context app;
  private final String token;
  CallTxBootstrap(Context app,String token){this.app=app.getApplicationContext();this.token=token;}
  boolean paired(){return app.getSharedPreferences("call_tx",0).getBoolean("localAdbPaired",false);}
  boolean probe(){
    try(Socket s=new Socket()){
      s.connect(new InetSocketAddress(LOCAL,CallTxShell.PORT),500);s.setSoTimeout(1200);
      DataInputStream in=new DataInputStream(s.getInputStream());DataOutputStream out=new DataOutputStream(s.getOutputStream());
      CallTxAuth.client(token,in,out);out.writeLong(0);out.flush();return "READY".equals(in.readUTF());
    }catch(Exception e){return false;}
  }
  private static synchronized Manager identity(Context app)throws Exception{
    // libadb SPAKE2 needs TLS exported key material from Conscrypt.
    if(Security.getProvider("Conscrypt")==null)Security.insertProviderAt(Conscrypt.newProvider(),1);
    File file=new File(app.getFilesDir(),"tx-adb-identity.bin");
    PrivateKey key;Certificate cert;
    if(file.exists()){
      try(DataInputStream in=new DataInputStream(new FileInputStream(file))){
        int n=in.readInt();if(n<=0||n>16384)throw new IOException("ADB key size");byte[] a=new byte[n];in.readFully(a);
        n=in.readInt();if(n<=0||n>16384)throw new IOException("ADB cert size");byte[] b=new byte[n];in.readFully(b);
        key=KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(a));
        cert=CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(b));
      }
    }else{
      KeyPairGenerator gen=KeyPairGenerator.getInstance("RSA");gen.initialize(2048);
      KeyPair kp=gen.generateKeyPair();key=kp.getPrivate();
      long now=System.currentTimeMillis();X500Name name=new X500Name("CN=HITEL Call TX");
      JcaX509v3CertificateBuilder builder=new JcaX509v3CertificateBuilder(name,new BigInteger(63,new SecureRandom()).add(BigInteger.ONE),new Date(now-86400000L),new Date(now+3650L*86400000L),name,kp.getPublic());
      byte[] der=builder.build(new JcaContentSignerBuilder("SHA256withRSA").build(key)).getEncoded();
      cert=CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(der));
      File tmp=new File(app.getFilesDir(),"tx-adb-identity.tmp");
      try(DataOutputStream out=new DataOutputStream(new FileOutputStream(tmp))){
        byte[] a=key.getEncoded();out.writeInt(a.length);out.write(a);out.writeInt(der.length);out.write(der);
      }
      if(!tmp.renameTo(file))throw new IOException("ADB identity save");
    }
    return new Manager(key,cert);
  }
  private static final class Manager extends AbsAdbConnectionManager{
    final PrivateKey key;final Certificate cert;
    Manager(PrivateKey k,Certificate c){key=k;cert=c;setApi(Build.VERSION.SDK_INT);setHostAddress(LOCAL);setTimeout(8,TimeUnit.SECONDS);}
    @Override protected PrivateKey getPrivateKey(){return key;}
    @Override protected Certificate getCertificate(){return cert;}
    @Override protected String getDeviceName(){return "HITEL Call TX";}
  }
  private int discover(String type)throws Exception{
    CountDownLatch latch=new CountDownLatch(1);AtomicInteger port=new AtomicInteger();
    AdbMdns mdns=new AdbMdns(app,type,(host,p)->{if(p>0){port.set(p);latch.countDown();}});
    try{mdns.start();if(!latch.await(8,TimeUnit.SECONDS))throw new IOException("무선 디버깅 포트를 찾지 못했습니다");return port.get();}
    finally{mdns.stop();}
  }
  void pair(int port,String code)throws Exception{
    if(Build.VERSION.SDK_INT<30)throw new IOException("Android 11 이상 필요");
    if(!code.matches("[0-9]{6}")||port<1||port>65535)throw new IOException("페어링 포트와 6자리 코드 확인");
    try(Manager manager=identity(app)){
      if(!manager.pair(LOCAL,port,code))throw new IOException("페어링 실패");
      app.getSharedPreferences("call_tx",0).edit().putBoolean("localAdbPaired",true).apply();
    }
  }
  synchronized void start(int port)throws Exception{
    if(probe())return;
    if(!paired())throw new IOException("최초 무선 디버깅 페어링 필요");
    if(port==0)port=discover(AdbMdns.SERVICE_TYPE_TLS_CONNECT);
    if(port<1||port>65535)throw new IOException("연결 포트 오류");
    try(Manager manager=identity(app)){
      if(!manager.connect(LOCAL,port))throw new IOException("휴대전화 내부 ADB 연결 실패");
      String apk=app.getApplicationInfo().sourceDir;
      if(!apk.matches("/[a-zA-Z0-9_./=+~-]+")||!token.matches("[0-9a-f]{32}"))throw new IOException("잘못된 앱 경로");
      // Explicit user-authorized shell session. Detach helper from the adb session.
      String cmd="CLASSPATH='"+apk+"' setsid nohup app_process /system/bin app.hitel.speakeronly.CallTxShell "+token+" </dev/null >/data/local/tmp/hitel-call-tx.out 2>&1 &";
      try(AdbStream stream=manager.openStream("exec:sh -c '"+cmd.replace("'","'\\''")+"'")){
        long end=SystemClock.elapsedRealtime()+8000;
        while(SystemClock.elapsedRealtime()<end){
          if(probe())return;
          SystemClock.sleep(200);
        }
      }
      throw new IOException("송신 보조 초기화 실패. Android 권한 또는 시스템 경로 확인 필요");
    }
  }
}
