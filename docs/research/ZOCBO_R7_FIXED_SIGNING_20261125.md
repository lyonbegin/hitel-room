# R7 fixed signing (persistent WebView build)
App source unchanged from 0b34ebb723d37be4b5d6fb8c5796321052a1b8cc. The build requires a permanent PKCS12 signing key (alias diagnostic; same key/store password) through GitHub Actions secrets ZOCBO_SIGNING_KEY_B64 and ZOCBO_SIGNING_PASSWORD. Never commit the private key or password. Never generate a replacement on CI. Keep a secure offline backup. The workflow fails before building if the secrets are missing. The release tag is unique per run/attempt; certificate proof accompanies APK.
One-time setup from a trusted PC with JDK and authenticated GitHub CLI:
```powershell
keytool -genkeypair -storetype PKCS12 -keystore "$HOME\zocbo-fixed.p12" -alias diagnostic -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=HITEL Diagnostic Test,O=HITEL,C=KR"
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\zocbo-fixed.p12")) | gh secret set ZOCBO_SIGNING_KEY_B64 -R lyonbegin/hitel-room
gh secret set ZOCBO_SIGNING_PASSWORD -R lyonbegin/hitel-room
```
Enter the same keystore password when GitHub CLI prompts. Run the workflow on feature/zocbo-r7-official-download-status-20261125 after configuration. APKs with previous random certificates may need one uninstall/reinstall; subsequent builds use adb install -r and preserve app data unless Android/server clears it or the user uninstalls. Do not delete existing data without backup.
Existing save commands unchanged:
```javascript
window.hitelPdfTitleLink.saveExam("15958886")
JSON.parse(window.hitelPdfTitleLink.officialSaveStatus())
```
Destination Download/HITEL-Zocbo/. No native viewer logic change. Authenticated save and upgrade continuity require device verification.