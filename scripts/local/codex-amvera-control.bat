@echo off
cd /d "%~dp0"
title Codex / Amvera Control
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0codex-amvera-control.ps1"
