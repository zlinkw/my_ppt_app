@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\uninstall-completely.ps1" -ConfirmCompleteRemoval
pause