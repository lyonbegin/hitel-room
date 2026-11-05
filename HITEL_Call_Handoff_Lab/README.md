# HITEL Call Handoff Lab v0.2.0

This is an installable Android debug APK proof of concept.
It NEVER replaces the system default dialer and never claims that OFFHOOK alone means a remote person answered.

1. Grant READ_PHONE_STATE and Display over other apps.
2. Start monitoring while the diagnostic app is visible.
3. Open the existing Phone app and place/receive a call.
4. On OFFHOOK, a small 'unverified' banner appears over the normal Phone app.
5. After a real person answers, manually confirm to expand to a full-screen HITEL diagnostic overlay.
6. On call ending (IDLE) the overlay disappears. The default Phone app remains unchanged.
7. Stop monitoring in the diagnostic app when finished.

Known limitations: no automatically verified far-end connected event; no voice RX/TX, speech-to-text, translation, or actual AI call functionality. Foreground service and overlay behavior must be verified on the target Samsung phone. This is NOT a reverse-engineered Samsung UI.

Package: app.hitel.callhandofflab
Android API: 26-35 (target 35)
