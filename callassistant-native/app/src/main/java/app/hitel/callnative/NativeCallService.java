package app.hitel.callnative;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.telecom.Call;
import android.telecom.CallAudioState;
import android.telecom.InCallService;
import android.telecom.VideoProfile;
import android.util.Log;

public class NativeCallService extends InCallService {
    public static volatile NativeCallService instance;
    public static volatile Call current;
    private static final String CHANNEL = "hitel_native_calls";
    private static final int NOTIFY = 405;
    private final Call.Callback events = new Call.Callback() {
        @Override public void onStateChanged(Call call, int state) {
            Log.i("HITEL_PHONE", "CALL_STATE=" + state);
            if (state == Call.STATE_DISCONNECTED) {
                removeNotification();
            } else showNotification(call);
        }
        @Override public void onDetailsChanged(Call call, Call.Details details) { showNotification(call); }
    };
    @Override public void onCreate() {
        super.onCreate();
        instance = this;
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "HITEL 전화", NotificationManager.IMPORTANCE_HIGH));
    }
    @Override public void onCallAdded(Call call) {
        super.onCallAdded(call);
        current = call;
        call.registerCallback(events);
        showNotification(call);
        Log.i("HITEL_PHONE", "CALL_ADDED=" + call.getState());
    }
    @Override public void onCallRemoved(Call call) {
        call.unregisterCallback(events);
        if (current == call) current = null;
        removeNotification();
        super.onCallRemoved(call);
        Log.i("HITEL_PHONE", "CALL_REMOVED");
    }
    static void answer() {
        Call c = current;
        if (c != null && c.getState() == Call.STATE_RINGING)
            c.answer(VideoProfile.STATE_AUDIO_ONLY);
    }
    static void reject() {
        Call c = current;
        if (c != null && c.getState() == Call.STATE_RINGING) c.reject(false, null);
    }
    void mute(boolean value) { setMuted(value); }
    void speaker(boolean value) {
        setAudioRoute(value ? CallAudioState.ROUTE_SPEAKER : CallAudioState.ROUTE_EARPIECE);
    }
    private PendingIntent launchUi() {
        Intent i = new Intent(this, CallActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 55, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private PendingIntent action(String action, int request) {
        Intent i = new Intent(this, CallActionReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(this, request, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private void showNotification(Call call) {
        if (call == null) return;
        boolean ringing = call.getState() == Call.STATE_RINGING;
        String who = "전화";
        try {
            if (call.getDetails().getHandle() != null)
                who = call.getDetails().getHandle().getSchemeSpecificPart();
        } catch (Exception ignored) {}
        Notification.Builder builder = new Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setContentTitle(ringing ? "수신 전화" : "통화 중")
            .setContentText(who).setCategory(Notification.CATEGORY_CALL)
            .setContentIntent(launchUi()).setOngoing(true);
        if (ringing) {
            builder.setPriority(Notification.PRIORITY_MAX)
                .setFullScreenIntent(launchUi(), true)
                .addAction(android.R.drawable.sym_action_call, "응답", action("answer",1))
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "거절", action("reject",2));
        }
        try { getSystemService(NotificationManager.class).notify(NOTIFY, builder.build()); }
        catch (SecurityException e) { Log.w("HITEL_PHONE", "NOTIFICATION_PERMISSION_MISSING", e); }
    }
    private void removeNotification() { getSystemService(NotificationManager.class).cancel(NOTIFY); }
    @Override public void onDestroy() { instance = null; current = null; removeNotification(); super.onDestroy(); }
}
