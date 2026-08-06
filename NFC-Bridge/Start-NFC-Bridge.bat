@echo off
setlocal
cd /d "%~dp0"
title Tabaja NFC Bridge - ACR122U
start "" powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Tabaja-NFC-Bridge.ps1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8766/?source=nfc"
exit /b
