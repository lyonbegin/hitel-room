package com.google.android.libraries.assistant.soda;

import java.nio.ByteBuffer;

/** Experimental, isolated JNI binding to the exact original Google speech library.
 * These declarations match the supplied APK's Soda.smali and exported ELF symbols.
 * This is not a replacement engine and does not register models with Google services.
 */
public final class Soda {
    public interface Listener {
        void event(byte[] payload);
        void signal(String name, int value);
    }
    private final Listener listener;
    public Soda(Listener listener) { this.listener=listener; }
    public static void load(String absolutePath) { System.load(absolutePath); }
    public static native long nativeCreateSharedResources(Object callback);
    public static native boolean nativeDeleteSharedResources(Object callback, long resources);
    public native long nativeConstruct(long resources);
    public native byte[] nativeInit(long handle, byte[] config);
    public native byte[] nativeStartCapture(long handle, byte[] config);
    public native boolean nativeAddAudio(long handle, ByteBuffer buffer, long bytes);
    public native void nativeStopCapture(long handle);
    public native void nativeDelete(long handle);
    protected void handleSodaEvent(byte[] payload) { listener.event(payload); }
    protected void handleStart() { listener.signal("HANDLE_START",0); }
    protected void handleStop(int status) { listener.signal("HANDLE_STOP",status); }
    protected void handleShutdown() { listener.signal("HANDLE_SHUTDOWN",0); }
}
