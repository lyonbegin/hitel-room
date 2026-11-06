package app.hitel.callnative;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.telephony.TelephonyManager;
import android.util.Log;

/**
 * Android's documented PHONE_STATE_CHANGED broadcast. Works without taking over
 * the default phone/dialer role. Only a coarse call state is exposed here:
 * IDLE / RINGING / OFFHOOK; no call audio, no phone-number recording.
 */
public final class PhoneStateReceiver extends BroadcastReceiver {
    public static final String TAG = "HITEL_MONITOR";
    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null || !TelephonyManager.ACTION_PHONE_STATE_CHANGED.equals(intent.getAction())) return;
        String state = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
        if (state == null) state = "UNKNOWN";
        Log.i(TAG, "CALL_STATE=" + state);
        Intent update = new Intent("app.hitel.callnative.CALL_STATE_CHANGED");
        update.setPackage(context.getPackageName());
        update.putExtra("state", state);
        context.sendBroadcast(update);
    }
}
