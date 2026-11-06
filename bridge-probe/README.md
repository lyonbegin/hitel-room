# Samsung Call Bridge Probe
This is an independent Android APK to test **actual Samsung Call Assistant components**, without changing the default phone app, becoming an assistant, or claiming to read call audio.
Test explicit startActivity for CallAssistViewerActivity and RecordViewerActivity, and explicit bindService for VoipTranslatorService; report signing, permissions, exports, and connection callbacks.
No dialer role switch, no call recording, no telephony audio routing changes.
Build: gradle -p bridge-probe :app:assembleDebug
The APK is available in GitHub Actions artifacts.
