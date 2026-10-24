# HITEL Communication SDK - Persistent Google Play Android emulator on Windows
# First run: powershell -ExecutionPolicy Bypass -File .\mobile\tools\start-persistent-windows.ps1 -Configure
# Every subsequent run: powershell -ExecutionPolicy Bypass -File .\mobile\tools\start-persistent-windows.ps1
# Requires Android SDK (Android Studio) and Python 3 on this host.
[CmdletBinding()]
param(
    [switch]$Configure,
    [string]$DeviceId = "android-lab-01",
    [string]$AvdName = "hitel-play",
    [string]$RepositoryRoot = ""
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $RepositoryRoot) { $RepositoryRoot = (Resolve-Path (Join-Path $scriptRoot "..\..")).Path }
$agent = Join-Path $RepositoryRoot "mobile\tools\apk-emulator-agent.py"
$stateDir = Join-Path $env:LOCALAPPDATA "HitelCommunication"
$secretsFile = Join-Path $stateDir "emulator-agent.credential"
New-Item -Type Directory -Force $stateDir | Out-Null

if ($Configure) {
    $password = Read-Host "Enter Railway LAB_APK_AGENT_TOKEN (will be Windows DPAPI encrypted)" -AsSecureString
    if ($password.Length -lt 32) { throw "Invalid short token" }
    $password | ConvertFrom-SecureString | Set-Content -Path $secretsFile -Encoding UTF8
    Write-Host "Agent credential encrypted under current Windows account: $secretsFile"
}

if (!(Test-Path $secretsFile)) { throw "Agent not configured. First run with -Configure" }
if (!(Test-Path $agent)) { throw "HITEL agent missing: $agent" }

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$adb = Join-Path $sdk "platform-tools\adb.exe"
$emulator = Join-Path $sdk "emulator\emulator.exe"
$sdkmanager = Join-Path $sdk "cmdline-tools\latest\bin\sdkmanager.bat"
$avdmanager = Join-Path $sdk "cmdline-tools\latest\bin\avdmanager.bat"

foreach ($item in @($sdkmanager,$avdmanager)) {
    if (!(Test-Path $item)) {
        throw "Android Studio SDK Command-line Tools (latest) must be installed at $item"
    }
}

if ($Configure) {
    Write-Host "Installing Android 35 Google Play SDK image on local Windows host..."
    & $sdkmanager "platform-tools" "emulator" "platforms;android-35" "system-images;android-35;google_apis_playstore;x86_64"
    if ($LASTEXITCODE -ne 0) { throw "Android SDK installation failed" }
}
foreach ($item in @($adb,$emulator)) {
    if (!(Test-Path $item)) { throw "Android SDK component missing: $item" }
}

$existing = @(& $emulator -list-avds)
if ($existing -notcontains $AvdName) {
    Write-Host "Creating Google Play-enabled persistent AVD $AvdName"
    "no" | & $avdmanager "create" "avd" "-n" $AvdName "-k" "system-images;android-35;google_apis_playstore;x86_64" "-f"
    if ($LASTEXITCODE -ne 0) { throw "Google Play AVD creation failed" }
}
$running = @(& $adb "devices")
if (-not ($running | Select-String -Pattern '^emulator-[0-9]+\s+device$')) {
    Write-Host "Starting persistent Android emulator; local GUI allows Google Play sign-in..."
    Start-Process -FilePath $emulator -ArgumentList @("-avd",$AvdName,"-gpu","swiftshader_indirect","-no-snapshot-load")
}

& $adb "wait-for-device"
if ($LASTEXITCODE -ne 0) { throw "ADB could not connect to emulator" }
$serialLines = @(& $adb "devices")
$serial = ($serialLines | Select-String -Pattern '^(emulator-[0-9]+)\s+device$' | Select-Object -First 1)
if (!$serial) { throw "No live Android emulator found" }
$serialValue = $serial.Matches[0].Groups[1].Value
$play = @(& $adb "-s" $serialValue "shell" "pm" "path" "com.android.vending")
if (-not ($play -match 'package:')) { throw "Selected Android image has no Google Play Store" }
Write-Host "Verified Google Play Store on $serialValue"

$pythonCommand = Get-Command "py" -ErrorAction SilentlyContinue
if ($pythonCommand) {
    $pythonBinary = $pythonCommand.Source
    $pythonArgs = @("-3", $agent,"--device",$DeviceId,"--serial",$serialValue)
} else {
    $pythonCommand = Get-Command "python" -ErrorAction Stop
    $pythonBinary = $pythonCommand.Source
    $pythonArgs = @($agent,"--device",$DeviceId,"--serial",$serialValue)
}

# Windows DPAPI: only this Windows account can decrypt the credential file.
$secure = (Get-Content -Raw $secretsFile) | ConvertTo-SecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:LAB_APK_AGENT_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
$env:LAB_RELAY_URL = "https://hitel-device-relay-production.up.railway.app"
Write-Host "HITEL persistent Android: $DeviceId ($serialValue), host agent connected to Railway"
Write-Host "Open /sdk-lab; the Android host will show online once screenshots arrive."
try {
    while ($true) {
        & $pythonBinary @pythonArgs
        Write-Warning "Android agent exited: restarting in 5 seconds..."
        Start-Sleep -Seconds 5
    }
} finally {
    Remove-Item Env:LAB_APK_AGENT_TOKEN -ErrorAction SilentlyContinue
}
