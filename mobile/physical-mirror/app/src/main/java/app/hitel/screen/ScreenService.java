package app.hitel.screen;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import android.content.Context;
import android.net.Uri;
import android.graphics.Color;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

public class ScreenService extends Service {
 public static volatile String state="화면 공유 대기";
 private static final String SERVER="wss://hitel-communication-web-production.up.railway.app/lab-sandbox/physical/socket";
 private final Handler main=new Handler(Looper.getMainLooper());
 private HandlerThread thread;
 private Handler capture;
 private MediaProjection projection;
 private VirtualDisplay display;
 private ImageReader reader;
 private OkHttpClient client;
 private WebSocket socket;
 private String pairingCode="";
 private boolean active=false;
 private volatile boolean online=false;
 private volatile long lastFrame=0;
 private int width=480,height=900;
 @Override public IBinder onBind(Intent i){return null;}
 @Override public int onStartCommand(Intent intent,int flags,int id){
  if(intent==null)return START_NOT_STICKY;
  if("STOP".equals(intent.getAction())){stopSelf();return START_NOT_STICKY;}
  if(!"START".equals(intent.getAction()))return START_NOT_STICKY;
  if(active){state="이미 화면을 전송하고 있습니다.";return START_NOT_STICKY;}
  active=true;
  pairingCode=intent.getStringExtra("code");
  if(pairingCode==null)pairingCode="";
  startNotification();
  int result=intent.getIntExtra("resultCode",0);
  Intent data;
  if(Build.VERSION.SDK_INT>=33)data=intent.getParcelableExtra("resultData",Intent.class);
  else data=(Intent)intent.getParcelableExtra("resultData");
  if(result==0||data==null){state="화면 공유 승인 정보가 없습니다.";stopSelf();return START_NOT_STICKY;}
  try{
   MediaProjectionManager mgr=(MediaProjectionManager)getSystemService(Context.MEDIA_PROJECTION_SERVICE);
   projection=mgr.getMediaProjection(result,data);
   if(projection==null)throw new IllegalStateException("MEDIA_PROJECTION_UNAVAILABLE");
   projection.registerCallback(new MediaProjection.Callback(){
    @Override public void onStop(){main.post(()->{state="휴대전화에서 화면 공유가 중지되었습니다.";stopSelf();});}
   },main);
   DisplayMetrics metrics=new DisplayMetrics();
   ((WindowManager)getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(metrics);
   final int actualW=Math.max(1,metrics.widthPixels),actualH=Math.max(1,metrics.heightPixels);
   width=Math.min(540,actualW);
   height=Math.max(1,Math.round((float)actualH*width/actualW));
   thread=new HandlerThread("HITEL-phone-capture");
   thread.start();capture=new Handler(thread.getLooper());
   reader=ImageReader.newInstance(width,height,PixelFormat.RGBA_8888,2);
   reader.setOnImageAvailableListener(r->onImage(r),capture);
   display=projection.createVirtualDisplay("HITEL Phone Screen",width,height,metrics.densityDpi,
    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,reader.getSurface(),null,capture);
   client=new OkHttpClient.Builder().pingInterval(20,TimeUnit.SECONDS).build();
   state="화면 캡처 승인됨 · Railway 연결 시도 중";
   connect();
  }catch(Exception e){state="화면 캡처 실행 오류: "+String.valueOf(e.getMessage());stopSelf();}
  return START_NOT_STICKY;
 }
 private void startNotification(){
  NotificationManager mgr=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
  String channel="hitel-physical-screen";
  if(Build.VERSION.SDK_INT>=26)mgr.createNotificationChannel(new NotificationChannel(channel,
   "HITEL 화면 공유",NotificationManager.IMPORTANCE_LOW));
  Intent stop=new Intent(this,ScreenService.class);stop.setAction("STOP");
  int flags=PendingIntent.FLAG_UPDATE_CURRENT;
  if(Build.VERSION.SDK_INT>=23)flags|=PendingIntent.FLAG_IMMUTABLE;
  PendingIntent action=PendingIntent.getService(this,1,stop,flags);
  Notification n=new Notification.Builder(this,channel).setContentTitle("HITEL 실제 휴대전화 화면 공유 중")
   .setContentText("SDK Lab으로 화면을 전송합니다. 탭하여 언제든 종료할 수 있습니다.")
   .setSmallIcon(android.R.drawable.ic_menu_view)
   .setOngoing(true).addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel,
    "공유 종료",action).build()).build();
  if(Build.VERSION.SDK_INT>=29)startForeground(22,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
  else startForeground(22,n);
 }
 private void connect(){
  if(!active||client==null)return;
  String deviceKey=getSharedPreferences("hitel-screen",MODE_PRIVATE).getString("deviceKey","");
  String uri=SERVER+"?role=device&"+(deviceKey.isEmpty()?"code="+Uri.encode(pairingCode):"deviceKey="+Uri.encode(deviceKey));
  Request request=new Request.Builder().url(uri).build();
  socket=client.newWebSocket(request,new WebSocketListener(){
   @Override public void onOpen(WebSocket ws,Response response){
    if(!active){ws.close(1000,"stopped");return;}
    online=true;state="실제 화면 전송 연결됨";
    try{
     JSONObject hello=new JSONObject();hello.put("type","hello");
     hello.put("name",Build.MANUFACTURER+" "+Build.MODEL);
     hello.put("android",Build.VERSION.RELEASE);hello.put("width",width);hello.put("height",height);
     ws.send(hello.toString());
    }catch(Exception ignored){}
   }
   @Override public void onMessage(WebSocket ws,String text){
    try{
     JSONObject msg=new JSONObject(text);
     if("paired".equals(msg.optString("type"))){
      String key=msg.optString("deviceKey","");
      if(key.matches("[a-f0-9]{64}"))
       getSharedPreferences("hitel-screen",MODE_PRIVATE).edit().putString("deviceKey",key).apply();
      state="화면 공유 연결 성공 · SDK Lab에서 실제 화면 확인";
     }else if("stop".equals(msg.optString("type"))){
      main.post(()->{state="웹에서 화면 공유가 종료되었습니다.";stopSelf();});
     }
    }catch(Exception ignored){}
   }
   @Override public void onFailure(WebSocket ws,Throwable e,Response response){
    online=false;state="연결 끊김: "+String.valueOf(e.getMessage());
    reconnect(ws);
   }
   @Override public void onClosed(WebSocket ws,int code,String reason){
    online=false;if(active)state="네트워크 재연결 중";
    reconnect(ws);
   }
   private void reconnect(WebSocket ws){
    if(!active||socket!=ws)return;
    main.postDelayed(()->{if(active&&socket==ws)connect();},3500);
   }
  });
 }
 private void onImage(ImageReader r){
  Image image=null;
  try{
   image=r.acquireLatestImage();
   if(image==null)return;
   long now=android.os.SystemClock.elapsedRealtime();
   if(!active||!online||socket==null||now-lastFrame<500)return;
   lastFrame=now;
   Image.Plane plane=image.getPlanes()[0];
   ByteBuffer buffer=plane.getBuffer();
   int pixelStride=plane.getPixelStride(),rowStride=plane.getRowStride();
   int fullWidth=rowStride/pixelStride;
   Bitmap padded=Bitmap.createBitmap(fullWidth,height,Bitmap.Config.ARGB_8888);
   padded.copyPixelsFromBuffer(buffer);
   Bitmap screenshot=Bitmap.createBitmap(padded,0,0,width,height);
   ByteArrayOutputStream out=new ByteArrayOutputStream(160000);
   screenshot.compress(Bitmap.CompressFormat.JPEG,62,out);
   byte[] data=out.toByteArray();
   if(data.length<700000)socket.send(ByteString.of(data));
   if(screenshot!=padded)screenshot.recycle();
   padded.recycle();
  }catch(Exception e){state="화면 프레임 오류: "+String.valueOf(e.getMessage());}
  finally{if(image!=null)image.close();}
 }
 @Override public void onDestroy(){
  active=false;online=false;
  if(socket!=null){socket.close(1000,"phone stopped");socket.cancel();socket=null;}
  if(display!=null){display.release();display=null;}
  if(reader!=null){reader.close();reader=null;}
  if(projection!=null){projection.stop();projection=null;}
  if(thread!=null){thread.quitSafely();thread=null;}
  if(client!=null){client.dispatcher().executorService().shutdown();client.connectionPool().evictAll();client=null;}
  state="화면 공유 종료됨";
  super.onDestroy();
 }
}
