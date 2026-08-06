@echo off
setlocal
cd /d "%~dp0"
title Tabaja NFC Bridge - ACR122U
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Tabaja-NFC-Bridge.ps1"
echo.
echo NFC Bridge stopped. Press any key to close.
pause >nul
