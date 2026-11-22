@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Galaxy Fold4 USB Internet - Gnirehtet

rem Galaxy Z Fold4 (SM-F936N) - use the already-authorized USB ADB device.
rem No Wi-Fi, root, or administrator privileges are required.
set "ROOT=C:\mmsimage\scrcpy-win64-v5.0.1\scrcpy-win64-v5.0.1"
set "ADB=%ROOT%\adb.exe"
set "GN_DIR=%ROOT%\gnirehtet"
set "GN_EXE=%GN_DIR%\gnirehtet.exe"
set "GN_APK=%GN_DIR%\gnirehtet.apk"
set "SERIAL=R3CT804BGQK"

echo =====================================================
echo   Galaxy Fold4 - PC Internet over USB (Gnirehtet)
echo   Device: %SERIAL%
echo =====================================================
echo.

if not exist "%ADB%" goto missing_adb
if not exist "%GN_EXE%" goto missing_exe
if not exist "%GN_APK%" goto missing_apk

"%ADB%" start-server >nul
"%ADB%" -s "%SERIAL%" shell echo ADB_OK >nul 2>&1
if errorlevel 1 goto adb_not_ready

echo [OK] USB debugging connection is authorized.
echo [INFO] Checking Gnirehtet Android client...
"%ADB%" -s "%SERIAL%" shell pm path com.genymobile.gnirehtet 2>nul | findstr /B /C:"package:" >nul
if errorlevel 1 (
    echo [INFO] Client not installed. Installing...
    "%ADB%" -s "%SERIAL%" install -r "%GN_APK%"
    if errorlevel 1 goto install_failed
) else (
    echo [OK] Gnirehtet client already installed.
)

echo.
echo [INFO] Starting USB reverse tethering.
echo [INFO] On the phone, tap OK on the VPN connection dialog, if shown.
echo [INFO] Keep this window open while using the connection.
echo [INFO] Press Ctrl+C to stop.
echo.

rem Gnirehtet resolves relative resources from the current working directory.
pushd "%GN_DIR%"
"%GN_EXE%" run "%SERIAL%"
set "RESULT=%ERRORLEVEL%"
popd

echo.
echo [INFO] Gnirehtet stopped. Exit code: %RESULT%
pause
exit /b %RESULT%

:adb_not_ready
echo [ERROR] Galaxy Fold4 is not ADB-authorized or not connected.
"%ADB%" devices -l
echo [HINT] Device %SERIAL% must show: device
pause
exit /b 1

:install_failed
echo [ERROR] Failed to install the Gnirehtet Android APK.
pause
exit /b 1

:missing_adb
echo [ERROR] ADB not found: %ADB%
pause
exit /b 1

:missing_exe
echo [ERROR] Gnirehtet EXE not found: %GN_EXE%
pause
exit /b 1

:missing_apk
echo [ERROR] Gnirehtet APK not found: %GN_APK%
pause
exit /b 1
