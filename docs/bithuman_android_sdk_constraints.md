# bitHuman Expression 2: Android SDK / IMX audit

Status: static analysis implementation, NOT a reconstructed rendering SDK.
Date: 2026-11-12.
Repo branch: feature/bithuman-expression2-imx-sdk-audit-20261112.

## What is implemented

- tools/bithuman_audit/inspect.py: SHA256, container signature, ZIP contents, manifest candidates, AAR classes.jar, javap public API, ELF symbol inventory, Maven POM dependencies.
- tools/bithuman_audit/test_inspect.py: completely offline mock-data tests.
- .github/workflows/bithuman-imx-sdk-audit.yml: GitHub Actions downloads official public artifacts into temporary runner storage, generates metadata-only JSON and Markdown, compiles upstream Android sample without an API secret, reports build result.
- Vendor IMX and SDK archives are NOT checked into this repository and are NOT uploaded as workflow artifacts.

## Official public sources

- Kotlin project: https://github.com/bithuman-product/bithuman-examples/tree/main/android/expression2-hello
- Updated examples: https://gitlab.com/bithuman/sdk/bithuman-examples
- SDK Maven AAR: https://maven.bithuman.ai/ai/bithuman/expression2-android/0.6.2/expression2-android-0.6.2.aar
- Maven POM: https://maven.bithuman.ai/ai/bithuman/expression2-android/0.6.2/expression2-android-0.6.2.pom
- Sample model (Wise Pup): https://api.bithuman.ai/v1/agent/A23WJF0199/model/download?model=expression-2
- SDK: https://docs.bithuman.ai/platforms/android
- Avatar container: https://docs.bithuman.ai/models/avatar-file
- Billing: https://docs.bithuman.ai/pricing

## Verified / documented restrictions

- Hardware: real ARM64 Android phone; Android emulator x86_64 cannot run the engine.
- Software: minSdk 26 for Expression 2; Android SDK platform 35 for upstream sample; JDK 17, Android Gradle Plugin 8.7+; legacy JNI packaging.
- Model: first download approximately 160 MB of identity data. IMX cache can require approximately the file size again when unpacked.
- APK dependency: main SDK approximately 3 MB; optional Qualcomm accelerator dependency about 70 MB. CPU fallback can be substantially slower; real device measurements are required.
- Audio input: PCM Float32 normalized to -1..1, 16 kHz mono. Audio input and audiovisual synchronisation are caller responsibilities.
- Video output: 416 x 720, 20 frames/sec, Bitmap frames via pull().
- Speech AI: ASR, LLM, TTS are separate. A talking-head SDK does not contain a general conversation pipeline.
- Remote creation: portrait-to-IMX model generation happens on the vendor side; no public IMX training code was found.
- Authentication: paid Creator or higher API secret; first launch model download and session credentials. Never store production API secret in public APK/BuildConfig.
- Offline behavior: after authenticated session starts, network loss permits at most 5 minutes of rendered output, then rendering pauses until the network returns.
- Billing (as documented November 2026): current on-device SDK online sessions bill 2 credits per minute of ACTUAL SPEAKING time, not all idle time. Cloud-hosted avatar bills connected session duration. Inspect official docs again before production pricing.
- Device temperature/performance: one published sample had first NPU initialization ~30s on Galaxy S25+; this is a sample measurement, not a performance guarantee.
- SDK releases: 0.x, APIs are subject to change; pin exact version and retest after updates.

## What static inspection can and cannot establish

AAR static examination establishes actual Java/Kotlin classes, shared libraries, public JNI symbols, declared dependencies and package shape. IMX examination can show header/container contents and metadata. Neither proves the cloud-side portrait-to-IMX algorithm or independently reproduces model weights. Authentication, user-avatar permissions, runtime frame rates, power draw, crash cases, facial quality and offline expiry require an on-device test.

## Running this code

GitHub Actions runs on push to this analysis branch. Find the workflow named "bitHuman Expression2 IMX SDK audit" on the Actions page. Download the "bithuman-structure-report" artifact containing report.json and report.md. If vendor URLs fail, the report explicitly says NOT_DOWNLOADED.

Local analysis after obtaining files:

python3 tools/bithuman_audit/inspect.py --imx wise-pup.imx --aar expression2-android-0.6.2.aar --pom expression2-android-0.6.2.pom --output reports/bithuman

Local smoke tests:

python3 -m unittest discover -s tools/bithuman_audit -p 'test_*.py'

## Planned next steps, not implemented in this branch

1. Compare artifact contents and POM dependency graph from real successful Actions run.
2. Run official compiled sample on a physical Android phone with valid vendor API credentials.
3. Benchmark warm/cold engine startup, CPU/NPU behavior, RAM, battery and 16 kHz live audio.
4. Develop an independent on-device model path only after choosing an openly available face synthesis model and identity representation.
