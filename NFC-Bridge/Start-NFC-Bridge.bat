@echo off
setlocal
cd /d "%~dp0"
title Tabaja NFC Bridge - ACR122U

rem Open the reliable same-origin NFC writer after the bridge has had time to start.
start "" powershell.exe -NoLogo -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8765/studio'"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Tabaja-NFC-Bridge.ps1"
echo.
echo NFC Bridge stopped. Press any key to close.
pause >nul
