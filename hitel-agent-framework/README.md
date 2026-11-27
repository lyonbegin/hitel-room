# HITEL Agent Framework — infrastructure phase

Upstreams (pinned for reproducibility):
- ARTEMIS: google/artemis @ 351ca8422f7b5b54e80a9c1ce03a222e02415b6b
- AI Edge Gallery: google-ai-edge/gallery @ 200ee1bbcf5d12d0c422753d86b6b7066b370ef3
- PokeClaw: agents-io/PokeClaw @ 936eca3ef7881e37908b5f183bf948ccaf1615e4

## Design

Start with an empty app inventory. A mission specifies the desired result, not a fixed app. ARTEMIS must inspect installed capabilities, discover a suitable app through Google Play if necessary, install it, determine login requirements, explore real screens, validate the procedure, and only then publish a reusable skill. Never guess an app's UI or bypass authentication. Login, CAPTCHA, OTP, consent, purchases and consequential actions require authorized interaction.

## CI (disposable, unauthenticated)

The HITEL Agent Framework Bootstrap workflow installs ARTEMIS, checks its real MCP tool registration, boots a Google Play emulator, compiles Gallery and PokeClaw separately and attempts to install/launch both. The ARM64 job checks host/image/KVM capability; it is not an ARM64 execution or model benchmark. A manual non-sensitive exploration mission can be supplied with a configured model API secret. New workflows on a feature branch may need to be merged or registered on the default branch before manual dispatch is available. Do not put private credentials or user-specific missions in public workflow input/logs.

## Persistent test phone (not provisioned by hosted CI)

Use a dedicated trusted Linux host with KVM, Android SDK, JDK, uv and an encrypted persistent disk. The public repository must never expose credential-bearing device storage or a runner executing untrusted PRs. Prefer a private repository/isolated trusted runner for authenticated tests. Configure a dedicated runner label `hitel-private-android`, protected environment of the same name, and absolute host path `HITEL_AVD_ROOT`. Run the lifecycle script:

```bash
export HITEL_AVD_ROOT=/private/hitel-avd
bash hitel-agent-framework/ci/persistent-emulator.sh provision
bash hitel-agent-framework/ci/persistent-emulator.sh start
# On this trusted host, use scrcpy or the Android emulator UI to sign in
# interactively to Google Play using a dedicated authorized test account.
bash hitel-agent-framework/ci/persistent-emulator.sh status
bash hitel-agent-framework/ci/persistent-emulator.sh stop
```

App installation and account data persist in the host AVD disk; they are never uploaded to GitHub. Login/session validity depends on each provider; reauthentication may be necessary. No fixed third-party APK list is preloaded.

## Remaining integration gates

1. Verify actual CI builds, emulator boot, MCP handshake and install/launch tests.
2. Provision authenticated persistent runner; manually establish authorized test accounts and verify restart persistence.
3. Connect Gallery's Streamable HTTP MCP client to an authenticated ARTEMIS endpoint.
4. Implement ARTEMIS-to-PokeClaw device gateway and execution/result adapter. Existing PokeClaw intent API is local, not a remote WebSocket API.
5. Validate dynamically discovered apps, skill generation/replay, permission handling and actual no-debugging user-device execution. Do not equate upstream APK compilation with integrated operation.
6. Verify Android model runtime, ARM64 and Google Play distribution policy.

These are explicit gates, not claims that integration or deployment is already complete.


## Phase 2 integration (development only)

The bootstrap workflow now also tests actual ARTEMIS device observation over authenticated Streamable HTTP MCP, the device approval/result protocol with a simulated client, a generic Play Store search entry, Android reboot storage retention, and the patched PokeClaw native bridge UI. The bridge uses the upstream External Automation contract; it is opt-in, checks for tasks on user action, requires explicit approval and HTTPS, and does not claim background autonomous execution. The actual native callback and Gallery model tool call require a running authenticated HTTPS gateway and mobile configuration. Gallery itself remains upstream/unmodified. Single-device prototype tokens must be distinct; do not use the prototype for multiple users or real credentials without hardening. Persistent authenticated AVD and third-party login require a dedicated trusted host and test account. The workflow labels those as blocked, not success. No target app catalog is shipped.
