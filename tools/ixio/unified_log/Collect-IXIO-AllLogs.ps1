param(
  [int]$Minutes = 10
)
$ErrorActionPreference = "Stop"
$adb = Join-Path (Get-Location) "adb.exe"
if (!(Test-Path $adb)) { $adb = "adb" }
$target = Join-Path (Get-Location) ("IXIO_FULL_LOGS_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Force -Path $target | Out-Null
$since = (Get-Date).AddMinutes(-$Minutes).ToString("MM-dd HH:mm:ss.fff")
& $adb devices | Out-File (Join-Path $target "adb_devices.txt") -Encoding utf8
& $adb logcat -d -b all -v threadtime -T "$since" |
    Out-File (Join-Path $target "03_ANDROID_SYSTEM_LOGCAT.txt") -Encoding utf8
$save = Join-Path $target "on_device_unified"
New-Item -ItemType Directory -Force -Path $save | Out-Null
& $adb pull "/sdcard/Download/IXIO_Logs" $save |
    Out-File (Join-Path $target "adb_pull.txt") -Encoding utf8
Set-Content -Path (Join-Path $target "README.txt") -Encoding utf8 -Value @"
Main app: tap 로그 > 전체 로그 저장·복사 to produce a main + recorder ZIP.
This PC script adds actual Android-system ADB logcat, including FGS and Binder.
Requested logcat lookback: $Minutes minutes. Captures whatever remains in device logcat buffers.
No log buffers are cleared.
"@
Compress-Archive -Path (Join-Path $target "*") -DestinationPath "$target.zip" -Force
Write-Host "Saved: $target.zip"
