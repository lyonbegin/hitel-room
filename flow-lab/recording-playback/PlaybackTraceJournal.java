package app.hitel.samsungprobe;

import android.util.Log;
import java.util.Locale;

/** Adapter for the EXISTING StreamingAacPcmDecoder's diagnostics.
 * Original decoder algorithm is unchanged; this binds its trace to the
 * existing HITEL14 W03 LabStore without importing the separate experiment UI.
 */
final class PlaybackTraceJournal {
    void event(String group, String action, Object... fields) {
        String details=fields(fields);
        Log.i("HITEL-GrowingPlayback",group+" "+action+" "+details);
        try { LabStore.log("GROWING_PLAYBACK_"+group+"_"+action,details); }
        catch (Throwable ignored) {}
    }
    void timing(String group, String action, Object... fields) {
        event(group,action,fields);
    }
    void error(String group, String action, Throwable failure) {
        event(group,action,"error",String.valueOf(failure));
    }
    static String fields(Object... pairs) {
        StringBuilder b=new StringBuilder();
        for (int i=0;i<pairs.length;i+=2) {
            if (i>0)b.append("; ");
            b.append(String.valueOf(pairs[i])).append('=');
            if (i+1<pairs.length)b.append(String.valueOf(pairs[i+1]));
        }
        return b.toString();
    }
}
