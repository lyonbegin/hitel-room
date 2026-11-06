package app.hitel.callnative;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public class CallActionReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context context, Intent intent) {
    if ("answer".equals(intent.getAction())) NativeCallService.answer();
    if ("reject".equals(intent.getAction())) NativeCallService.reject();
  }
}
