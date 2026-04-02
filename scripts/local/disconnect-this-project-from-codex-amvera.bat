@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0disconnect-this-project-from-codex-amvera.ps1"
pause
