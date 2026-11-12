@echo off
title Bug-Lizzer TV bridge
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is needed to run the TV bridge.
  echo Opening the download page - install the "LTS" version, then double-click this file again.
  start https://nodejs.org/en/download
  pause
  exit /b
)
if not exist node_modules\lgtv2 (
  echo First run: installing the TV library...
  call npm install --no-audit --no-fund
)
node bridge.js
pause
