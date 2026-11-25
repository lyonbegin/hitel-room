# Single Activity / five worker QA (2026-11-26)
Base: e171f3193161f945fd924cbe793fce53b02ff609 (Clean APK). Worker source/test commit: 6926930372af8a66fc6428f3917cbdeb8401c1c9.

Local JVM test of the copied scheduler and test source:
```
javac com/hitel/zocbodiag/NativeFiveWorkerPool.java PoolTest.java
java PoolTest
PASS 1000 unique terminal jobs, peak=5, duplicate start refused, failure isolated
PASS rate-limited: no further claims, active work drained
```
This is a simulated processor, not an Android or live server test.

Original trace: https://github.com/lyonbegin/hitel-room/actions/runs/45140997725
The extracted Y0 constructor has eight injected dependencies and per-instance mutable state; original Activity onCreate initializes intent fields and schedules coroutines. A single shared Y0 with overwritten exam IDs is not a valid five-worker implementation. Existing Activity destruction drives bridge completion, and must not be used as a worker completion signal.

Pending: independent authorized operation adapter, Android single-Activity UI integration, Android build and runtime verification. No new APK has been produced. Existing server authentication, authorization and rate limits must remain intact.
