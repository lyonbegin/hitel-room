# Zocbo R15 regression root cause and verification status (2026-11-24)

## Runtime failure provided by user
- Actual screenshot: "원본 지역 선택기의 '전체' 항목을 찾지 못했습니다 ... 저장된 지역 0곳 / 시험지 0건, 저장 DB: 0건."
- This is an actual device failure. No collected metadata may be inferred from it.

## Confirmed regression
- R14 branched from old R13 release commit 2231ab0ccd77c1027ddd07e8b786d30fe1cc4206.
- The active feature/zocbo-pdf-api-trace-20261123 branch had 11 subsequent commits, including the original ui.js data-order-selector fix.
- R14 accidentally restored the obsolete text-based search across the entire DOM, instead of the source-verified .region .tab__button[data-order] and matching .region .tab__content[data-order], and lost original selector URL query parameters.
- The R14 source rollback explains the selector implementation regression. It does not independently prove that all live server collection errors are solved.

## R15 modifications
- Restores the newer ReadingAreaSelector.java from the feature branch.
- Restores selector URL construction from the original preceding previousExam.asp URL, preserving relevant filters.
- Accepts original Kind=REGION scope with a genuine city or region filter, without fabricating a school ID.
- Retains R14 SQLite v2 area checkpoints, per-area first-page persistence, pause/resume, CSV/JSON exports.
- Test original regionFilter data-order tab clicking with compiled production JS, with explicit simulated DOM: JS regression pass.
- Separate live anonymous original HTML test executed on CI: curl exit 28 / connection timeout 15 sec / no HTML data.
- No successful authenticated original server row response / exam_no persistence proof has been obtained. A signed APK build is NOT proof of those steps.

## Test pass requirements (must not claim success until all)
1. On an authenticated real device, display non-zero original region selector choices and count a successful left data-order → matching right tab '전체' click.
2. Confirm original previousExam.asp AJAX returned an actual list of numeric expapr_no values.
3. Assert after each response that DB COUNT(exams)>0 and sampled exam_no equals a source-observed exam_no.
4. Pause, export CSV, confirm CSV rows equal committed DB snapshot.
5. Force stop/relaunch, resume from committed area/page and verify no loss or duplicate exam_no.
6. Check native viewer and old main login/network path do not regress.

Keep older test APKs/branch records; do not delete or replace user's app data during verification.
