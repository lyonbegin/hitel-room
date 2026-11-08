package app.hitel.samsungprobe;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.ActivityManager;
import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MicrophoneDirection;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.NoiseSuppressor;
import android.view.accessibility.AccessibilityManager;
import java.util.List;

/**
 * A/B controls informed by Google Voice Access reverse engineering.
 * These are isolated, user-selected Android public API experiments.
 * They do not claim to reproduce Google's proprietary recognizer or to bypass
 * Samsung telephony microphone routing.
 *
 * One instance per AudioRecord; NEVER create a second microphone.
 */
public final class VoiceAccessAudioTrial {
    public static final String[] MODES={
        "0 기존 STT (비교 기준)",
        "1 Voice Access 방식 · 잡음억제 NS",
        "2 Voice Access 방식 · 반향제거 AEC",
        "3 Voice Access 방식 · 마이크 사용자 방향",
        "4 Voice Access 방식 · NS+AEC+방향",
        "5 내장 마이크 경로 지정 요청",
        "6 NS+AEC+방향+내장마이크 요청"
    };

    private final Context context;
    private final AudioRecord recorder;
    private final int mode;
    private NoiseSuppressor ns;
    private AcousticEchoCanceler aec;
    private AudioDeviceInfo preferredInput;
    private boolean closed=false;

    public VoiceAccessAudioTrial(Context c, AudioRecord r, int requestedMode) {
        context=c.getApplicationContext();
        recorder=r;
        mode=Math.max(0,Math.min(MODES.length-1,requestedMode));
        log("START","mode="+mode+"; label="+MODES[mode]+
            "; audioSession="+recorder.getAudioSessionId()+
            "; requestedSource="+recorder.getAudioSource()+
            "; note=VoiceAccess-inspired A/B test, not guaranteed Samsung route override");
        snapshotA11y();
        snapshotAudio("BEFORE_OPTIONS");
    }
    public static String name(int m) {
        return MODES[Math.max(0,Math.min(MODES.length-1,m))];
    }
    private void log(String what,String value){
        LabStore.log("VA_AB_"+what,"mode="+mode+"; "+value);
    }
    private boolean wantsNs(){return mode==1||mode==4||mode==6;}
    private boolean wantsAec(){return mode==2||mode==4||mode==6;}
    private boolean wantsDirection(){return mode==3||mode==4||mode==6;}
    private boolean wantsBuiltIn(){return mode==5||mode==6;}

    private void snapshotA11y() {
        boolean registered=false;
        int services=0;
        try {
            AccessibilityManager mgr=(AccessibilityManager)context.getSystemService(Context.ACCESSIBILITY_SERVICE);
            if(mgr!=null){
                List<AccessibilityServiceInfo> enabled=mgr.getEnabledAccessibilityServiceList(
                    AccessibilityServiceInfo.FEEDBACK_ALL_MASK);
                if(enabled!=null) {
                    services=enabled.size();
                    for(AccessibilityServiceInfo service:enabled) {
                        if(service.getResolveInfo()!=null &&
                            service.getResolveInfo().serviceInfo!=null &&
                            context.getPackageName().equals(
                                service.getResolveInfo().serviceInfo.packageName)) {
                            registered=true;break;
                        }
                    }
                }
            }
            ActivityManager.RunningAppProcessInfo process=new ActivityManager.RunningAppProcessInfo();
            ActivityManager.getMyMemoryState(process);
            log("A11Y_STATE","enabledForPackage="+registered+
                "; enabledServiceCount="+services+
                "; serviceConnected="+CallAccessibilityService.serviceConnected()+
                "; processImportance="+process.importance+
                "; note=UID policy internal isA11yOnTop cannot be read with public API");
        } catch(Throwable err){
            log("A11Y_ERROR",err.toString());
        }
    }

    private static String device(AudioDeviceInfo d) {
        if(d==null)return "null";
        return "id="+d.getId()+"/type="+d.getType()+"/label="+d.getProductName();
    }
    private void snapshotAudio(String point) {
        try {
            AudioManager manager=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
            log("ROUTE_"+point,"audioMode="+(manager==null?-999:manager.getMode())+
                "; isMicrophoneMute="+(manager!=null&&manager.isMicrophoneMute())+
                "; requestedSource="+recorder.getAudioSource()+
                "; recordingState="+recorder.getRecordingState()+
                "; preferredDevice="+device(recorder.getPreferredDevice())+
                "; actualRoutedDevice="+device(recorder.getRoutedDevice())+
                "; audioSession="+recorder.getAudioSessionId());
            if(manager!=null && ("BEFORE_OPTIONS".equals(point)||"AFTER_OPTIONS".equals(point))){
                AudioDeviceInfo[] available=manager.getDevices(AudioManager.GET_DEVICES_INPUTS);
                for(AudioDeviceInfo d:available)
                    log("AVAILABLE_INPUT","point="+point+"; "+device(d));
            }
        }catch(Throwable err){
            log("ROUTE_ERROR","point="+point+"; error="+err);
        }
    }

    public void configureBeforeStart() {
        if(wantsNs()) {
            try {
                boolean avail=NoiseSuppressor.isAvailable();
                ns=avail?NoiseSuppressor.create(recorder.getAudioSessionId()):null;
                int result=ns==null?-1:ns.setEnabled(true);
                log("NS","available="+avail+"; instance="+(ns!=null)+
                    "; setResult="+result+"; active="+(ns!=null&&ns.getEnabled())+
                    "; hasControl="+(ns!=null&&ns.hasControl()));
            }catch(Throwable err){log("NS_ERROR",err.toString());}
        }else log("NS","notRequested=true");
        if(wantsAec()) {
            try {
                boolean avail=AcousticEchoCanceler.isAvailable();
                aec=avail?AcousticEchoCanceler.create(recorder.getAudioSessionId()):null;
                int result=aec==null?-1:aec.setEnabled(true);
                log("AEC","available="+avail+"; instance="+(aec!=null)+
                    "; setResult="+result+"; active="+(aec!=null&&aec.getEnabled())+
                    "; hasControl="+(aec!=null&&aec.hasControl()));
            }catch(Throwable err){log("AEC_ERROR",err.toString());}
        }else log("AEC","notRequested=true");
        if(wantsDirection()) {
            try{
                boolean result=recorder.setPreferredMicrophoneDirection(
                    MicrophoneDirection.MIC_DIRECTION_TOWARDS_USER);
                log("DIRECTION","requested=TOWARDS_USER(1); accepted="+result+
                    "; note=request is not physical-device routing proof");
            }catch(Throwable err){log("DIRECTION_ERROR",err.toString());}
        }else log("DIRECTION","notRequested=true");
        if(wantsBuiltIn()){
            try {
                AudioManager mgr=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
                if(mgr!=null){
                    for(AudioDeviceInfo input:mgr.getDevices(AudioManager.GET_DEVICES_INPUTS)){
                        if(input.getType()==AudioDeviceInfo.TYPE_BUILTIN_MIC){
                            preferredInput=input;break;
                        }
                    }
                }
                boolean success=preferredInput!=null&&recorder.setPreferredDevice(preferredInput);
                log("BUILTIN_REQUEST","found="+(preferredInput!=null)+
                    "; requested="+device(preferredInput)+"; accepted="+success+
                    "; actualCheckIsAfterStart=true");
            }catch(Throwable err){log("BUILTIN_ERROR",err.toString());}
        } else log("BUILTIN_REQUEST","notRequested=true");
        snapshotAudio("AFTER_OPTIONS");
    }
    public void afterRecordingStarted(){
        snapshotA11y();
        snapshotAudio("AFTER_RECORDING_START");
        if(mode!=0) {
            log("EFFECTIVE","ns="+(ns==null?"none":ns.getEnabled())+
                "; aec="+(aec==null?"none":aec.getEnabled())+
                "; enabledEffectsAreNotProofOfMicCaptureDuringSamsungTextCall");
        }
    }
    public void close(){
        if(closed)return;
        closed=true;
        snapshotAudio("BEFORE_RELEASE");
        if(ns!=null)try{ns.release();log("NS_RELEASED","true");}
            catch(Throwable err){log("NS_RELEASE_ERROR",err.toString());}
        if(aec!=null)try{aec.release();log("AEC_RELEASED","true");}
            catch(Throwable err){log("AEC_RELEASE_ERROR",err.toString());}
        if(preferredInput!=null){
            try{recorder.setPreferredDevice(null);}catch(Throwable ignored){}
        }
        log("END","mode="+mode+"; effectsReleased=true; recorderAndONNXReleasedByExistingEngine=true");
    }
}
