@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0connect-this-project-to-codex-amvera.ps1"
pause
