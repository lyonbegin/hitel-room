"""Patch only a pinned flutter_webrtc 1.4.0 checkout, not vendor SDKs."""
from pathlib import Path
import argparse, shutil
p=argparse.ArgumentParser()
p.add_argument("--webrtc", type=Path, required=True)
p.add_argument("--app", type=Path, required=True)
p.add_argument("--repo", type=Path, required=True)
a=p.parse_args()
def replace(s, old, new):
    assert s.count(old)==1, old
    return s.replace(old,new)
root=Path(__file__).parent
java=a.webrtc/"android/src/main/java/com/cloudwebrtc/webrtc"
for name in ("HitelArCoreCapturer.java","HitelAvatarVideoCapturer.java","HitelAvatarMediaBus.java"):
    shutil.copyfile(root/"android"/name,java/name)
paired=a.webrtc/"android/src/main/java/ai/hitel/media"
paired.mkdir(parents=True,exist_ok=True)
shutil.copyfile(root/"android/HitelPairedAvQueue.java",paired/"HitelPairedAvQueue.java")
source=java/"GetUserMediaImpl.java"
s=source.read_text()
s=replace(s,'CameraEventsHandler cameraEventsHandler = new CameraEventsHandler();\n        Pair<String, VideoCapturer> result = createVideoCapturer(cameraEnumerator, isFacing, deviceId, cameraEventsHandler);',
'''boolean hitelMask = videoConstraintsMap != null && videoConstraintsMap.hasKey("hitelMode") &&
                    "mask".equals(videoConstraintsMap.getString("hitelMode"));
        boolean hitelAvatar = videoConstraintsMap != null && videoConstraintsMap.hasKey("hitelMode") &&
                    "avatar".equals(videoConstraintsMap.getString("hitelMode"));
        CameraEventsHandler cameraEventsHandler = new CameraEventsHandler();
        Pair<String, VideoCapturer> result = hitelAvatar
            ? new Pair<>("hitel-avatar", new HitelAvatarVideoCapturer())
            : hitelMask ? new Pair<>("hitel-arcore", new HitelArCoreCapturer())
            : createVideoCapturer(cameraEnumerator, isFacing, deviceId, cameraEventsHandler);
        if (hitelMask || hitelAvatar) facingMode = "user";''')
s=replace(s,'''        info.cameraEventsHandler = cameraEventsHandler;
        videoCapturer.startCapture(targetWidth, targetHeight, targetFps);

        cameraEventsHandler.waitForCameraOpen();''','''        info.cameraEventsHandler = (hitelMask || hitelAvatar) ? null : cameraEventsHandler;
        try {
            videoCapturer.startCapture(targetWidth, targetHeight, targetFps);
            if (!hitelMask && !hitelAvatar) cameraEventsHandler.waitForCameraOpen();
        } catch (RuntimeException e) {
            Log.e(TAG, "Video capture failed", e);
            videoCapturer.dispose();
            surfaceTextureHelper.dispose();
            videoSource.dispose();
            return null;
        }''')
source.write_text(s)
handler=java/"MethodCallHandlerImpl.java"
s=handler.read_text()
s=replace(s,"    audioDeviceModuleBuilder.setSamplesReadyCallback(recordSamplesReadyCallbackAdapter);",
"""    audioDeviceModuleBuilder.setAudioBufferCallback(HitelAvatarMediaBus::onAudioBuffer);
    audioDeviceModuleBuilder.setSamplesReadyCallback(recordSamplesReadyCallbackAdapter);""")
s=replace(s,"    audioDeviceModule = audioDeviceModuleBuilder.createAudioDeviceModule();",
"""    audioDeviceModule = audioDeviceModuleBuilder.createAudioDeviceModule();
    HitelAvatarMediaBus.setAudioDevice(audioDeviceModule);""")
handler.write_text(s)
gradle=a.webrtc/"android/build.gradle"
s=gradle.read_text()
s=replace(s,"    implementation 'io.github.webrtc-sdk:android:144.7559.01'",
"""    implementation 'io.github.webrtc-sdk:android:144.7559.01'
    implementation 'com.google.ar:core:1.46.0'""")
gradle.write_text(s)
assets=a.app/"android/app/src/main/assets"
assets.mkdir(parents=True,exist_ok=True)
shutil.copyfile(a.repo/"mobile/ios/CallApp/Resources/face-mask.png", assets/"hitel-face-mask.png")
shutil.copyfile(a.repo/"mobile/ios/CallApp/Resources/MINDAR-LICENSE.txt",assets/"HITEL-MINDAR-LICENSE.txt")
manifest=a.app/"android/app/src/main/AndroidManifest.xml"
s=manifest.read_text()
s=replace(s,"    </application>",'''        <meta-data android:name="com.google.ar.core" android:value="optional"/>
    </application>''')
manifest.write_text(s)
print("PASS_ARCORE_OPTIONAL_CUSTOM_WEBRTC_CAPTURER_WIRED")
