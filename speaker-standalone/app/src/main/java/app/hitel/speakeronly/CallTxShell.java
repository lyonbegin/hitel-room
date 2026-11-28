package app.hitel.speakeronly;

import android.app.Application;
import android.app.Instrumentation;
import android.content.Context;
import android.media.AudioManager;
import android.os.Looper;
import android.os.Process;
import java.io.*;
import java.lang.reflect.*;
import java.net.*;
import java.security.MessageDigest;

/** User-started ADB shell process; only authenticated loopback PCM, no recording or call control. */
public final class CallTxShell {
  static final int PORT=28743;
  public static void main(String[] args)throws Exception{
    if(Process.myUid()!=2000||args.length!=1||!args[0].matches("[0-9a-f]{32}"))
      throw new SecurityException("Run from user-authorized adb shell with the app's token");
    Looper.prepareMainLooper();
    Context ctx=shellContext();
    if(ctx.checkSelfPermission("android.permission.MODIFY_PHONE_STATE")!=android.content.pm.PackageManager.PERMISSION_GRANTED)
      throw new SecurityException("Shell lacks MODIFY_PHONE_STATE");
    AudioManager audio=(AudioManager)ctx.getSystemService(Context.AUDIO_SERVICE);
    // Some Samsung frameworks retain the system context in the cached service.
    for(String field:new String[]{"mOriginalContext","mApplicationContext"})try{
      Field f=AudioManager.class.getDeclaredField(field);f.setAccessible(true);f.set(audio,ctx);
    }catch(NoSuchFieldException ignored){}
    ServerSocket server=new ServerSocket();
    server.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"),PORT));
    System.out.println("HITEL_CALL_TX_READY uid="+Process.myUid()+" port="+PORT);
    final String token=args[0];
    Thread worker=new Thread(()->{
      while(true){
        try(Socket s=server.accept()){
          s.setSoTimeout(4000);
          DataInputStream in=new DataInputStream(new BufferedInputStream(s.getInputStream()));
          DataOutputStream out=new DataOutputStream(s.getOutputStream());
          CallTxAuth.server(token,in,out);
          long size=in.readLong();
          if(size==0){out.writeUTF("READY");out.flush();continue;}
          if(audio.getMode()!=AudioManager.MODE_IN_CALL||size<0||size>CallTxDecode.MAX_BYTES||(size&1)!=0){out.writeUTF("ERROR: NO_ACTIVE_VOICE_CALL_OR_BAD_PCM");out.flush();continue;}
          out.writeUTF("ACCEPTED");out.flush();
          try{long n=CallTxPlayer.send(audio,in,size,()->!s.isClosed());out.writeUTF("LOCAL_DRAIN_COMPLETE "+n);}
          catch(Throwable e){android.util.Log.e("HITEL_CALL_TX","TX_FAIL",e);out.writeUTF("ERROR: "+e);}
          out.flush();
        }catch(Throwable e){android.util.Log.e("HITEL_CALL_TX","SESSION_FAIL",e);}
      }
    },"HITEL-TX-Loopback");
    worker.start();Looper.loop();
  }
  private static Context shellContext()throws Exception{
    // Same ActivityThread initialization pattern as scrcpy/JemRec; identity is the actual shell UID.
    Class<?> at=Class.forName("android.app.ActivityThread");
    Constructor<?> ctor=at.getDeclaredConstructor();ctor.setAccessible(true);Object thread=ctor.newInstance();
    Field cur=at.getDeclaredField("sCurrentActivityThread");cur.setAccessible(true);cur.set(null,thread);
    Field system=at.getDeclaredField("mSystemThread");system.setAccessible(true);system.setBoolean(thread,true);
    if(android.os.Build.VERSION.SDK_INT>=31)try{
      Class<?> cc=Class.forName("android.app.ConfigurationController");
      Constructor<?> c=cc.getDeclaredConstructor(Class.forName("android.app.ActivityThreadInternal"));c.setAccessible(true);
      Field f=at.getDeclaredField("mConfigurationController");f.setAccessible(true);f.set(thread,c.newInstance(thread));
    }catch(ReflectiveOperationException ignored){}
    Method sc=at.getDeclaredMethod("getSystemContext");sc.setAccessible(true);
    Context systemContext=(Context)sc.invoke(thread);
    Context ctx=systemContext.createPackageContext("com.android.shell",0);
    Application app=Instrumentation.newApplication(Application.class,ctx);
    Field initial=at.getDeclaredField("mInitialApplication");initial.setAccessible(true);initial.set(thread,app);
    return ctx;
  }
}
