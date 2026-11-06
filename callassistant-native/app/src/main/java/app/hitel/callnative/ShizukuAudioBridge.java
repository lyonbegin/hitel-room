package app.hitel.callnative;

import android.content.ComponentName;
import android.content.Context;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Parcel;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.concurrent.atomic.AtomicBoolean;

import rikka.shizuku.Shizuku;

/** Local IPC only. No SIP, server, socket to network or cloud. */
final class ShizukuAudioBridge {
    interface Event { void received(String log); }
    private static final String TAG = "HITEL_ANDROID_PCM";
    private static final int REQ_PERMISSION = 702;
    private static final int FRAME = 640;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Event listener;
    private final Shizuku.UserServiceArgs args;
    private IBinder service;
    private ParcelFileDescriptor endpoint;
    private final AtomicBoolean capturing = new AtomicBoolean(false);
    private Thread downThread;
    private long downFrames = 0;
    private long upFrames = 0;
    private int downPeak = 0;
    private String status = "Shizuku 미연결";

    ShizukuAudioBridge(Context context, Event event) {
        listener = event;
        args = new Shizuku.UserServiceArgs(new ComponentName(context.getPackageName(), ShellAudioService.class.getName()))
                .daemon(false).processNameSuffix("hitel-shell").tag("hitel-local-pcm-v1").version(2);
    }
    private void report(String text) {
        status = text;
        Log.i(TAG, text);
        main.post(() -> listener.received(text));
    }
    String getStatus() { return status + " | down=" + downFrames + " up=" + upFrames + " peak=" + downPeak; }
    boolean isCapturing() { return capturing.get() && endpoint != null; }

    private final Shizuku.OnBinderReceivedListener binderReady = () -> report("Shizuku 실행 확인");
    private final Shizuku.OnRequestPermissionResultListener permissionResult = (code, grant) -> {
        if (code != REQ_PERMISSION) return;
        if (grant == PackageManager.PERMISSION_GRANTED) bind();
        else report("Shizuku 권한 거절됨");
    };
    private final Shizuku.OnBinderDeadListener binderDead = () -> {
        service = null;
        closeLocal();
        report("Shizuku 중단됨");
    };
    private final ServiceConnection connection = new ServiceConnection() {
        @Override public void onServiceConnected(ComponentName name, IBinder binder) {
            service = binder;
            try {
                String info = transactString(ShellAudioService.PING);
                if (!info.contains("uid=2000") && !info.contains("uid=0"))
                    throw new SecurityException("UserService not running as shell/root: " + info);
                report("Android 권한 연결: " + info);
            } catch (Throwable e) {
                service = null;
                report("Shizuku 서비스 확인 실패: " + e.getMessage());
            }
        }
        @Override public void onServiceDisconnected(ComponentName name) {
            service = null; closeLocal(); report("Shizuku 서비스 연결 해제");
        }
    };

    void attach() {
        try {
            Shizuku.addBinderReceivedListenerSticky(binderReady);
            Shizuku.addBinderDeadListener(binderDead);
            Shizuku.addRequestPermissionResultListener(permissionResult);
            if (Shizuku.pingBinder()) report("Shizuku 실행 중: 연결 버튼을 누르십시오.");
            else report("Shizuku가 실행되지 않았습니다. 앱에서 먼저 시작하십시오.");
        } catch (Throwable e) { report("Shizuku 초기화 오류: " + e.getMessage()); }
    }
    void requestConnection() {
        try {
            if (!Shizuku.pingBinder()) { report("Shizuku 앱을 실행하고 시작하십시오."); return; }
            if (Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED) bind();
            else Shizuku.requestPermission(REQ_PERMISSION);
        } catch (Throwable e) { report("Shizuku 연결 오류: " + e.getMessage()); }
    }
    private void bind() {
        try { report("Shizuku UserService 연결 시도"); Shizuku.bindUserService(args, connection); }
        catch (Throwable e) { report("UserService 바인딩 실패: " + e.getMessage()); }
    }
    private String transactString(int operation) throws Exception {
        IBinder binder = service;
        if (binder == null) throw new IllegalStateException("Shizuku UserService not connected");
        Parcel request = Parcel.obtain(); Parcel response = Parcel.obtain();
        try {
            boolean ok = binder.transact(operation, request, response, 0);
            if (!ok) throw new IllegalStateException("service refused operation " + operation);
            response.readException();
            return response.readString();
        } finally { request.recycle(); response.recycle(); }
    }
    void start(int kind) {
        new Thread(() -> {
            closeLocal();
            try {
                if (service == null) throw new IllegalStateException("먼저 Shizuku를 연결하십시오.");
                Parcel req = Parcel.obtain(); Parcel res = Parcel.obtain();
                String description;
                ParcelFileDescriptor result;
                try {
                    req.writeInt(kind);
                    if (!service.transact(ShellAudioService.START, req, res, 0))
                        throw new IllegalStateException("UserService rejected START");
                    res.readException();
                    description = res.readString();
                    result = res.readParcelable(ParcelFileDescriptor.class.getClassLoader());
                } finally { req.recycle(); res.recycle(); }
                if (result == null) throw new IllegalStateException("PCM pipe not received");
                endpoint = result;
                capturing.set(true);
                downFrames = 0; upFrames = 0; downPeak = 0;
                startDownlinkReader(result);
                report(description);
            } catch (Throwable error) { report("Android PCM 시작 실패: " + error.getClass().getSimpleName() + " " + error.getMessage()); }
        }, "hitel-shizuku-start").start();
    }
    private void startDownlinkReader(ParcelFileDescriptor fd) {
        downThread = new Thread(() -> {
            FileInputStream stream = new FileInputStream(fd.getFileDescriptor());
            byte[] frame = new byte[FRAME];
            try {
                while (capturing.get()) {
                    int offset = 0;
                    while (offset < FRAME && capturing.get()) {
                        int read = stream.read(frame, offset, FRAME - offset);
                        if (read <= 0) throw new IllegalStateException("local PCM socket closed");
                        offset += read;
                    }
                    if (!capturing.get()) break;
                    downFrames++;
                    for (int i = 0; i < FRAME; i += 2) {
                        int v = (short) ((frame[i] & 255) | (frame[i+1] << 8));
                        if (Math.abs(v) > downPeak) downPeak = Math.abs(v);
                    }
                    if (downFrames % 100 == 0) report("Android PCM 2초 수신: frames=" + downFrames + ", peak=" + downPeak +
                            " (음성 원천과 상대방 송신은 실제 단말 검증 필요)");
                }
            } catch (Throwable e) {
                if (capturing.get()) report("PCM 수신 종료: " + e.getMessage());
            } finally { closeLocal(); }
        }, "hitel-android-downlink");
        downThread.start();
    }
    void sendTone() {
        ParcelFileDescriptor fd = endpoint;
        if (!capturing.get() || fd == null) { report("먼저 Android PCM 추출·주입을 시작하십시오."); return; }
        new Thread(() -> {
            try {
                FileOutputStream stream = new FileOutputStream(fd.getFileDescriptor());
                byte[] frame = new byte[FRAME];
                for (int k = 0; k < 35 && capturing.get(); k++) {
                    for (int i = 0; i < FRAME / 2; i++) {
                        double time = (k * 320 + i) * 1.0 / 16000;
                        short value = (short) (Math.sin(time * 2 * Math.PI * 800) * 4600);
                        frame[i*2] = (byte) value;
                        frame[i*2+1] = (byte) (value >> 8);
                    }
                    stream.write(frame);
                    upFrames++;
                    Thread.sleep(18);
                }
                report("Android 테스트 PCM 800Hz 송신 요청 완료: " + upFrames + "프레임; 상대방 청취 검증 필요");
            } catch (Throwable e) { report("Android PCM 송신 실패: " + e.getMessage()); }
        }, "hitel-android-inject").start();
    }
    void stop() {
        closeLocal();
        new Thread(() -> {
            try { report(transactString(ShellAudioService.STOP)); }
            catch (Throwable e) { report("Android PCM 중단: " + e.getMessage()); }
        }, "hitel-shizuku-stop").start();
    }
    private void closeLocal() {
        capturing.set(false);
        ParcelFileDescriptor old = endpoint;
        endpoint = null;
        if (old != null) try { old.close(); } catch (Throwable ignored) {}
    }
    void detach() {
        closeLocal();
        try { if (service != null) transactString(ShellAudioService.STOP); }
        catch (Throwable e) { Log.w(TAG, "stop on detach failed", e); }
        try { Shizuku.unbindUserService(args, connection, true); } catch (Throwable ignored) {}
        try {
            Shizuku.removeBinderReceivedListener(binderReady);
            Shizuku.removeBinderDeadListener(binderDead);
            Shizuku.removeRequestPermissionResultListener(permissionResult);
        } catch (Throwable ignored) {}
        service = null;
    }
}
