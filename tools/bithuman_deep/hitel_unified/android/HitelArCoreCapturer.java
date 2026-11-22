package com.cloudwebrtc.webrtc;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.SurfaceTexture;
import android.opengl.GLES11Ext;
import android.opengl.GLES20;
import android.opengl.GLUtils;
import android.opengl.Matrix;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Log;
import android.view.Surface;
import android.hardware.display.DisplayManager;
import android.view.Display;

import com.google.ar.core.ArCoreApk;
import com.google.ar.core.AugmentedFace;
import com.google.ar.core.Camera;
import com.google.ar.core.CameraConfig;
import com.google.ar.core.CameraConfigFilter;
import com.google.ar.core.Config;
import com.google.ar.core.Coordinates2d;
import com.google.ar.core.Frame;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingState;
import com.cloudwebrtc.webrtc.utils.EglUtils;
import org.webrtc.CapturerObserver;
import org.webrtc.EglBase;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.VideoCapturer;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.ShortBuffer;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** ARCore owns the front camera only while this capturer is active.
 * AR camera and mesh are rendered together for the SAME ARCore Frame.
 * Output goes directly through a GPU Surface into the existing WebRTC source.
 */
final class HitelArCoreCapturer implements VideoCapturer {
    private static final String TAG = "HitelARCore";
    private static final String MASK_ASSET = "hitel-face-mask.png";
    private Context context;
    private SurfaceTextureHelper helper;
    private CapturerObserver observer;
    private HandlerThread thread;
    private Handler gl;
    private Session session;
    private EglBase egl;
    private Surface output;
    private volatile boolean active, produced;
    private int w, h, fps, cameraTex, maskTex, cameraProgram, maskProgram, lastRotation = -1;
    private long lastFrameNs;
    private final FloatBuffer quad = floats(-1,-1, 1,-1, -1,1, 1,1);
    private final FloatBuffer cameraUv = floats(0,0, 1,0, 0,1, 1,1);
    private final float[] model = new float[16], view = new float[16],
        projection = new float[16], mv = new float[16], mvp = new float[16];

    @Override public void initialize(SurfaceTextureHelper helper, Context context, CapturerObserver observer) {
        this.helper = helper; this.context = context.getApplicationContext(); this.observer = observer;
    }
    @Override public void startCapture(int width, int height, int framerate) {
        if (thread != null) throw new IllegalStateException("ARCore capturer already started");
        w = width; h = height; fps = Math.max(1, Math.min(30, framerate));
        // AR is optional so normal calls remain available on unsupported devices.
        ArCoreApk.Availability availability = ArCoreApk.getInstance().checkAvailability(context);
        if (availability != ArCoreApk.Availability.SUPPORTED_INSTALLED) {
            throw new IllegalStateException("ARCore 지원 및 Google Play AR 서비스 설치 확인 필요: " + availability);
        }
        helper.setTextureSize(w, h);
        helper.startListening(frame -> { if (active) observer.onFrameCaptured(frame); });
        thread = new HandlerThread("hitel-arcore-egl"); thread.start();
        gl = new Handler(thread.getLooper());
        CountDownLatch done = new CountDownLatch(1);
        final Throwable[] failure = new Throwable[1];
        gl.post(() -> {
            try {
                setup();
                active = true;
                observer.onCapturerStarted(true);
                gl.post(render);
            } catch (Throwable e) {
                failure[0] = e; active = false; cleanup();
            } finally { done.countDown(); }
        });
        try {
            if (!done.await(12, TimeUnit.SECONDS)) throw new IllegalStateException("ARCore start timed out");
            if (failure[0] != null) throw new IllegalStateException("ARCore start failed", failure[0]);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); throw new IllegalStateException(e);
        }
    }
    private void setup() throws Exception {
        egl = EglBase.create(EglUtils.getRootEglBaseContext(), EglBase.CONFIG_PLAIN);
        output = new Surface(helper.getSurfaceTexture());
        egl.createSurface(output); egl.makeCurrent();
        cameraTex = texture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES);
        maskTex = texture(GLES20.GL_TEXTURE_2D);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, maskTex);
        try (java.io.InputStream input = context.getAssets().open(MASK_ASSET)) {
            Bitmap bitmap = BitmapFactory.decodeStream(input);
            if (bitmap == null) throw new IllegalStateException("ARCore face texture missing");
            try { GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0); }
            finally { bitmap.recycle(); }
        }
        cameraProgram = program(
            "attribute vec2 aPosition; attribute vec2 aUv; varying vec2 vUv; void main(){gl_Position=vec4(aPosition,0.,1.);vUv=aUv;}",
            "#extension GL_OES_EGL_image_external : require\nprecision mediump float; varying vec2 vUv; uniform samplerExternalOES uTex; void main(){gl_FragColor=texture2D(uTex,vUv);}");
        maskProgram = program(
            "attribute vec3 aPosition; attribute vec2 aUv; uniform mat4 uMvp; varying vec2 vUv; void main(){gl_Position=uMvp*vec4(aPosition,1.);vUv=aUv;}",
            "precision mediump float; varying vec2 vUv; uniform sampler2D uTex; void main(){vec4 c=texture2D(uTex,vUv);gl_FragColor=c;}");
        session = new Session(context);
        CameraConfigFilter filter = new CameraConfigFilter(session);
        filter.setFacingDirection(CameraConfig.FacingDirection.FRONT);
        List<CameraConfig> configs = session.getSupportedCameraConfigs(filter);
        if (configs.isEmpty()) throw new IllegalStateException("Front camera ARCore config unavailable");
        session.setCameraConfig(configs.get(0));
        Config config = new Config(session);
        config.setAugmentedFaceMode(Config.AugmentedFaceMode.MESH3D);
        config.setUpdateMode(Config.UpdateMode.LATEST_CAMERA_IMAGE);
        config.setPlaneFindingMode(Config.PlaneFindingMode.DISABLED);
        config.setLightEstimationMode(Config.LightEstimationMode.DISABLED);
        session.configure(config);
        session.setCameraTextureName(cameraTex);
        updateGeometry();
        session.resume();
    }
    private void updateGeometry() {
        DisplayManager dm = (DisplayManager) context.getSystemService(Context.DISPLAY_SERVICE);
        Display display = dm == null ? null : dm.getDisplay(Display.DEFAULT_DISPLAY);
        int rotation = display == null ? Surface.ROTATION_0 : display.getRotation();
        if (rotation != lastRotation) {
            session.setDisplayGeometry(rotation, w, h);
            lastRotation = rotation;
        }
    }
    private final Runnable render = new Runnable() {
        @Override public void run() {
            if (!active) return;
            long begun = System.nanoTime();
            try {
                updateGeometry();
                Frame frame = session.update();
                long timestamp = frame.getTimestamp();
                if (timestamp > 0 && timestamp != lastFrameNs) {
                    lastFrameNs = timestamp;
                    draw(frame);
                    // Timestamp of this camera+face frame, not the wall clock after drawing.
                    egl.swapBuffers(timestamp);
                    produced = true;
                }
            } catch (Throwable failure) {
                Log.e(TAG, "ARCore render failed; never report a fake mask frame", failure);
                active = false;
                observer.onCapturerStopped();
                cleanup();
                return;
            }
            if (active) gl.postDelayed(this, Math.max(1, 1000 / fps - (System.nanoTime() - begun) / 1000000));
        }
    };
    private void draw(Frame frame) {
        GLES20.glViewport(0,0,w,h);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glClearColor(0,0,0,1);
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);
        quad.position(0); cameraUv.position(0);
        frame.transformCoordinates2d(Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES,
                quad, Coordinates2d.TEXTURE_NORMALIZED, cameraUv);
        GLES20.glUseProgram(cameraProgram);
        bindTexture(cameraProgram, GLES11Ext.GL_TEXTURE_EXTERNAL_OES, cameraTex);
        attrib(cameraProgram, "aPosition", 2, quad);
        attrib(cameraProgram, "aUv", 2, cameraUv);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        disable(cameraProgram, "aPosition"); disable(cameraProgram, "aUv");
        Camera camera = frame.getCamera();
        camera.getViewMatrix(view,0);
        camera.getProjectionMatrix(projection,0,0.01f,100f);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glUseProgram(maskProgram);
        bindTexture(maskProgram, GLES20.GL_TEXTURE_2D, maskTex);
        for (AugmentedFace face : session.getAllTrackables(AugmentedFace.class)) {
            if (face.getTrackingState() != TrackingState.TRACKING) continue;
            face.getCenterPose().toMatrix(model,0);
            Matrix.multiplyMM(mv,0,view,0,model,0);
            Matrix.multiplyMM(mvp,0,projection,0,mv,0);
            GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(maskProgram,"uMvp"),1,false,mvp,0);
            FloatBuffer vertices = face.getMeshVertices();
            FloatBuffer uv = face.getMeshTextureCoordinates();
            ShortBuffer triangles = face.getMeshTriangleIndices();
            vertices.rewind(); uv.rewind(); triangles.rewind();
            attrib(maskProgram,"aPosition",3,vertices);
            attrib(maskProgram,"aUv",2,uv);
            GLES20.glDrawElements(GLES20.GL_TRIANGLES, triangles.remaining(),
                    GLES20.GL_UNSIGNED_SHORT, triangles);
            disable(maskProgram,"aPosition"); disable(maskProgram,"aUv");
        }
        GLES20.glDisable(GLES20.GL_BLEND);
    }
    private static FloatBuffer floats(float... v) {
        FloatBuffer b = ByteBuffer.allocateDirect(v.length*4).order(ByteOrder.nativeOrder()).asFloatBuffer();
        b.put(v).position(0); return b;
    }
    private static int texture(int target) {
        int[] t = new int[1]; GLES20.glGenTextures(1,t,0); GLES20.glBindTexture(target,t[0]);
        GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR);
        GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_MAG_FILTER,GLES20.GL_LINEAR);
        GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_WRAP_S,GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_WRAP_T,GLES20.GL_CLAMP_TO_EDGE);
        return t[0];
    }
    private static int shader(int type, String source) {
        int s = GLES20.glCreateShader(type); GLES20.glShaderSource(s,source); GLES20.glCompileShader(s);
        int[] ok = new int[1]; GLES20.glGetShaderiv(s,GLES20.GL_COMPILE_STATUS,ok,0);
        if (ok[0] == 0) throw new IllegalStateException(GLES20.glGetShaderInfoLog(s));
        return s;
    }
    private static int program(String v, String f) {
        int vs = shader(GLES20.GL_VERTEX_SHADER,v), fs = shader(GLES20.GL_FRAGMENT_SHADER,f);
        int p = GLES20.glCreateProgram(); GLES20.glAttachShader(p,vs); GLES20.glAttachShader(p,fs); GLES20.glLinkProgram(p);
        GLES20.glDeleteShader(vs); GLES20.glDeleteShader(fs);
        int[] ok = new int[1]; GLES20.glGetProgramiv(p,GLES20.GL_LINK_STATUS,ok,0);
        if (ok[0] == 0) throw new IllegalStateException(GLES20.glGetProgramInfoLog(p));
        return p;
    }
    private static void bindTexture(int p,int target,int tex) {
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0); GLES20.glBindTexture(target,tex);
        GLES20.glUniform1i(GLES20.glGetUniformLocation(p,"uTex"),0);
    }
    private static void attrib(int p,String name,int size,FloatBuffer b) {
        int at = GLES20.glGetAttribLocation(p,name); b.position(0);
        GLES20.glEnableVertexAttribArray(at); GLES20.glVertexAttribPointer(at,size,GLES20.GL_FLOAT,false,0,b);
    }
    private static void disable(int p,String name) {
        GLES20.glDisableVertexAttribArray(GLES20.glGetAttribLocation(p,name));
    }
    private void cleanup() {
        if (session != null) { try { session.pause(); } catch (Exception ignored) {} session.close(); session=null; }
        if (egl != null) {
            if (cameraProgram != 0) GLES20.glDeleteProgram(cameraProgram);
            if (maskProgram != 0) GLES20.glDeleteProgram(maskProgram);
            GLES20.glDeleteTextures(2,new int[]{cameraTex,maskTex},0);
            egl.release(); egl=null;
        }
        if (output != null) { output.release(); output=null; }
    }
    @Override public void stopCapture() throws InterruptedException {
        if (thread == null) return;
        final boolean wasActive = active;
        active = false;
        gl.removeCallbacks(render);
        CountDownLatch done = new CountDownLatch(1);
        gl.post(() -> { try { cleanup(); if (wasActive) observer.onCapturerStopped(); } finally { done.countDown(); } });
        if (!done.await(8,TimeUnit.SECONDS)) Log.e(TAG,"ARCore cleanup deadline exceeded");
        helper.stopListening();
        thread.quitSafely(); thread.join(2000);
        thread=null; gl=null; produced=false;
    }
    @Override public void changeCaptureFormat(int width,int height,int framerate) { /* keep stable geometry during this capture */ }
    @Override public void dispose() {
        try { stopCapture(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
    @Override public boolean isScreencast() { return false; }
}
