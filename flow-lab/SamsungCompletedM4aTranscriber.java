package app.hitel.samsungprobe;

import android.content.Context;
import java.io.File;
import java.io.IOException;

/**
 * HITEL14 phone-independent file-STT entrypoint.
 *
 * The entire M4A -> PCM -> sherpa OfflineRecognizer sequence is delegated
 * to the MIT-licensed Transcriber Android source adaptation:
 *  - TranscriberM4aDecoder.kt
 *  - TranscriberLocalAudioBudget.kt
 *  - TranscriberWhisperFileStt.kt
 *  - TranscriberWhisperModelStore.kt
 *
 * Do NOT start, pause, stop or replace the HITEL14 microphone or telephone.
 */
final class SamsungCompletedM4aTranscriber {
    interface Progress {
        void onPhase(String text);
        void onSentence(String sentence);
    }
    private SamsungCompletedM4aTranscriber(){}

    static String transcribe(File file,Context context,Progress progress)throws Exception {
        if(context==null||file==null||!file.isFile()||file.length()==0)
            throw new IOException("전사할 완료 M4A 파일이 없습니다.");
        LabStore.log("SAMSUNG_REC_MIT_TRANSCRIBER_START",
            "source=Majkey25/transcriber-android;" +
            " engine=OfflineRecognizer; model=Whisper-small-int8;" +
            " Korean=ko; file="+file.getName()+"; size="+file.length()+
            "; micUnchanged=true; phoneUnchanged=true");
        return TranscriberWhisperFileStt.transcribe(context,file,
            new TranscriberWhisperFileStt.Progress(){
                @Override public void onPhase(String text){
                    progress.onPhase(text);
                }
                @Override public void onSentence(String sentence){
                    progress.onSentence(sentence);
                }
            });
    }
}
