@echo off
rem Double-click to launch Drone Show Simulator on Windows.
rem First run installs dependencies (needs Node.js 22+ and an internet connection).
setlocal
cd /d "%~dp0"
title Drone Show Simulator

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and try again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies. This only happens the first time...
  call npm install
  if errorlevel 1 goto failed
)

if not exist "node_modules\electron\dist\" (
  echo Downloading Electron...
  call node node_modules\electron\install.js
  if errorlevel 1 goto failed
)

echo Starting Drone Show Simulator...
call npm start
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo Something went wrong. See the messages above.
pause
exit /b 1
