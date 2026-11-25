# R7 toolbar / normal viewer UI test source
- Remove Share, Raw original, and redundant standalone PDF launcher from diagnostic toolbar.
- One persisted viewer ON/OFF switch. No overlay.
- Real user title taps in ON mode use the same row's original free-reading action, preserving original web authority and native viewer handling; no separate HITEL entry activity.
- OFF prevents that title-triggered viewer launch; it is not a cache-only acquisition mode. Original cache storage and retention untouched.
- Direct JavaScript titleSelected is intentionally non-acquiring. No batch automation, cache-only acquisition or offline entitlement change.
- Source inspection only; no compiled or device-tested APK yet.