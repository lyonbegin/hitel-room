# 족보닷컴 진단판: 메인 → 다른 화면 이동 시 '네트워크 상태를 확인' 팝업 원본 역공학

검증 대상: 원본 \`족보닷컴 4.3.11(2)\` XAPK (SHA-256 \`d45ba34990d4f4eaaad126371023bba74be0ca120b4b26e78af2c4a8fa2ba3a5\`).
출처: https://github.com/lyonbegin/hitel-room/actions/runs/45105188117
분석 파일: \`network_failure_audit.json\`, \`network_path_detail.txt\`.

## 문제의 메시지에는 두 경로가 있음

1. \`R.string.error_mas_network_error\`, resource ID \`0x7f1100e4\`, value:
   \`서비스 연결이 원활하지 않습니다.\n네트워크 상태를 확인하고\n다시 시도해주세요.\`
   - \`CommonWebviewActivity.java:4896-4908\`: \`NETWORK_CONNECTING_ERROR\` dialog.
   - \`p079i3/C1173q0.java:171-181\`: \`NETWORK_ERROR_TAG\` common dialog during launch/version check.
2. \`R.string.error_msg_601_title\`, \`R.string.error_msg_601_message\`
   - \`p127n3/g.java:35-53\`: exception \`UnknownHostException\` -> status \`601\`; timeout \`600\`, ConnectException \`602\`, other \`603\`.
   - \`A3/C0201s.java:50-75\`: status \`601\` renders the same title/description.

## Direct root-cause candidate of 'main screen works, another screen fails'

\`CommonWebviewActivity.java:4856-4908\` performs the following **before initializing the WebView**:

\`\`\`java
ConnectivityManager cm=(ConnectivityManager)context.getSystemService("connectivity");
Network network=cm.getActiveNetwork();
if (network != null) {
  NetworkCapabilities nc=cm.getNetworkCapabilities(network);
  Integer kbps=nc != null ? nc.getLinkDownstreamBandwidthKbps() : null;
  if(kbps != null && kbps>=100) {
    // Initialize p239z3.e WebView + navigation handlers
  } else {
    // Display NETWORK_CONNECTING_ERROR; no page request attempted in this branch
  }
} else {
  // Display NETWORK_CONNECTING_ERROR
}
\`\`\`

This is an **estimated local link bandwidth** test, not proof of actual Internet reachability. Android documentation warns \`getNetworkCapabilities\` is instantaneous and can become stale; \`getLinkDownstreamBandwidthKbps\` reports only the estimated first-hop transport bandwidth:
https://developer.android.com/reference/android/net/NetworkCapabilities

This is a **verified client-side conditional** and explains how the pop-up can occur even while the main screen otherwise works. However, no user's on-device \`getActiveNetwork\` and \`getLinkDownstreamBandwidthKbps\` values have been logged, so the specific live failure branch remains to be confirmed.

## Other plausible root causes not yet eliminated

- The same text is emitted by splash/version-check and a separate status-601 exception pathway. The message alone cannot distinguish them.
- Test APKs were re-signed with a different certificate from the developer original; app/server/SDK signature-bound authentication can fail. No signature rejection response has been observed.
- Exact HTTP failing host/status and real device stack traces not yet collected.
- The earlier GitHub emulator QA run https://github.com/lyonbegin/hitel-room/actions/runs/45103039931 failed while the *emulator was booting* (\`emulator-5554 not found\`) before app install. No app runtime success claimed.

## Correct intervention

For a **diagnostic build**, add logs at \`CommonWebviewActivity\` before this conditional: active network present?, capabilities present?, downstream bandwidth integer, Internet/Validated capabilities; log failure reason when entering either error path.

For a **robust app**, remove the \`>=100 kbps\` gate rather than forging a speed value. Attempt WebView navigation; record \`onReceivedError\` / \`onReceivedHttpError\` and show a specific DNS / HTTP / TLS / authentication message on real failures. Keep all existing login and server auth unchanged.

## ADB read-only host verification

In Windows PowerShell:
\`\`\`powershell
.\adb.exe shell dumpsys connectivity | Select-String -Pattern 'LinkDnBandwidth|LinkDownstream|VALIDATED|DefaultNetwork'
\`\`\`
This shows platform network capabilities, not necessarily a synchronized reading of the exact Activity call. Confirm in-app via targeted instrumentation to be definitive.
