# HITEL Communication SDK: Windows persistent Android Google Play emulator.
# First use: powershell -ExecutionPolicy Bypass -File .\mobile\tools\start-persistent-windows.ps1 -Configure -InstallAutostart
# Subsequent use: powershell -ExecutionPolicy Bypass -File .\mobile\tools\start-persistent-windows.ps1
# Requires local Android Studio SDK command line tools and Python 3.
[CmdletBinding()]
param(
    [switch]$Configure,
    [switch]$InstallAutostart,
    [string]$DeviceId = "android-lab-01",
    [string]$AvdName = "hitel-play",
    [string]$RepositoryRoot = ""
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptPath = $MyInvocation.MyCommand.Path
$scriptRoot = Split-Path -Parent $scriptPath
if (-not $RepositoryRoot) {
    $RepositoryRoot = (Resolve-Path (Join-Path $scriptRoot "..\..")).Path
}
$agent = Join-Path $RepositoryRoot "mobile\tools\apk-emulator-agent.py"
$stateDir = Join-Path $env:LOCALAPPDATA "HitelCommunication"
$secretsFile = Join-Path $stateDir "emulator-agent.credential"
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

if ($Configure) {
    $password = Read-Host "Railway LAB_APK_AGENT_TOKEN (secure input)" -AsSecureString
    if ($password.Length -lt 32) { throw "Invalid short Railway token" }
    $password | ConvertFrom-SecureString | Set-Content -Path $secretsFile -Encoding UTF8
    Write-Host "Windows DPAPI credential written to account-private local file."
}
if ($InstallAutostart) {
    $startup = [Environment]::GetFolderPath("Startup")
    if (-not $startup) { throw "Windows Startup folder unavailable" }
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut(
        (Join-Path $startup "HITEL Android Emulator.lnk")
    )
    $shortcut.TargetPath = (Get-Command "powershell.exe" -ErrorAction Stop).Source
    $shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' +
        $scriptPath + '" -DeviceId "' + $DeviceId + '" -AvdName "' + $AvdName + '"'
    $shortcut.WorkingDirectory = $RepositoryRoot
    $shortcut.Save()
    Write-Host "HITEL auto-start is registered for current Windows account."
}
if (!(Test-Path $secretsFile)) { throw "Run with -Configure to set Railway agent credential." }
if (!(Test-Path $agent)) { throw "HITEL Python agent not found at $agent" }

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not $env:JAVA_HOME) {
    $jbr = "C:\Program Files\Android\Android Studio\jbr"
    if (Test-Path (Join-Path $jbr "bin\java.exe")) { $env:JAVA_HOME = $jbr }
}
$adb = Join-Path $sdk "platform-tools\adb.exe"
$emulator = Join-Path $sdk "emulator\emulator.exe"
$sdkmanager = Join-Path $sdk "cmdline-tools\latest\bin\sdkmanager.bat"
$avdmanager = Join-Path $sdk "cmdline-tools\latest\bin\avdmanager.bat"
if (!(Test-Path $sdkmanager) -or !(Test-Path $avdmanager)) {
    throw "Android Studio SDK Command-line Tools (latest) are required at $sdk"
}
if ($Configure) {
    & $sdkmanager "platform-tools" "emulator" "platforms;android-35" "system-images;android-35;google_apis_playstore;x86_64"
    if ($LASTEXITCODE -ne 0) { throw "Google Play Android SDK image installation failed" }
}
if (!(Test-Path $adb) -or !(Test-Path $emulator)) {
    throw "ADB or Android emulator missing in Android SDK $sdk"
}

$avds = @(& $emulator "-list-avds")
if ($avds -notcontains $AvdName) {
    "no" | & $avdmanager "create" "avd" "-n" $AvdName "-k" "system-images;android-35;google_apis_playstore;x86_64" "-f"
    if ($LASTEXITCODE -ne 0) { throw "Google Play AVD creation failed" }
}
$running = @(& $adb "devices")
if (-not ($running | Select-String -Pattern '^emulator-[0-9]+\s+device$')) {
    Start-Process -FilePath $emulator -ArgumentList @(
        "-avd",$AvdName,"-gpu","swiftshader_indirect","-no-snapshot-load"
    )
}

$booted = $false
for ($attempt = 0; $attempt -lt 120; $attempt++) {
    Start-Sleep -Seconds 3
    $lines = @(& $adb "devices")
    if ($lines | Select-String -Pattern '^emulator-[0-9]+\s+device$') {
        $flag = @(& $adb "shell" "getprop" "sys.boot_completed")
        if ($flag -contains "1") { $booted = $true; break }
    }
}
if (-not $booted) { throw "Android emulator did not finish booting within 6 minutes" }
$deviceLines = @(& $adb "devices")
$matchingLine = $deviceLines | Select-String -Pattern '^(emulator-[0-9]+)\s+device$' | Select-Object -First 1
if (-not $matchingLine) { throw "No online ADB Android emulator" }
$serial = $matchingLine.Matches[0].Groups[1].Value
$play = @(& $adb "-s" $serial "shell" "pm" "path" "com.android.vending")
if (-not ($play -match 'package:')) { throw "Selected Android emulator does not contain Google Play Store" }
Write-Host "Android Google Play AVD is booted: $serial"

$py = Get-Command "py" -ErrorAction SilentlyContinue
if ($py) {
    $pythonBinary = $py.Source
    $pythonArgs = @("-3",$agent,"--device",$DeviceId,"--serial",$serial)
} else {
    $pythonBinary = (Get-Command "python" -ErrorAction Stop).Source
    $pythonArgs = @($agent,"--device",$DeviceId,"--serial",$serial)
}

$secure = (Get-Content -Raw $secretsFile).Trim() | ConvertTo-SecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:LAB_APK_AGENT_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
$env:LAB_RELAY_URL = "https://hitel-device-relay-production.up.railway.app"
Write-Host "HITEL Android host $DeviceId: connected to Railway management service."
try {
    while ($true) {
        & $pythonBinary @pythonArgs
        Write-Warning "HITEL Android agent stopped; restarting after 5 seconds."
        Start-Sleep -Seconds 5
    }
} finally {
    Remove-Item Env:LAB_APK_AGENT_TOKEN -ErrorAction SilentlyContinue
}
