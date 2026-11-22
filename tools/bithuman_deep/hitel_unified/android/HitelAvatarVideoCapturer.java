package com.cloudwebrtc.webrtc;
import android.content.Context;
import org.webrtc.CapturerObserver;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.VideoCapturer;
final class HitelAvatarVideoCapturer implements VideoCapturer {
    private SurfaceTextureHelper helper;
    private CapturerObserver observer;
    private HitelAvatarMediaBus.Session session;
    @Override public void initialize(SurfaceTextureHelper h,Context c,CapturerObserver o){helper=h;observer=o;}
    @Override public void startCapture(int w,int h,int fps){session=HitelAvatarMediaBus.open(helper,observer,w,h);}
    @Override public void stopCapture(){if(session!=null){HitelAvatarMediaBus.close(session);session=null;}}
    @Override public void changeCaptureFormat(int w,int h,int fps){}
    @Override public void dispose(){stopCapture();}
    @Override public boolean isScreencast(){return false;}
}
