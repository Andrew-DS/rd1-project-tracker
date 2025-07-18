@echo off
title RD1 Project Tracker

REM === CONFIG ===
set "MODE=development"  REM Change to production to run against deployed site

REM === NAVIGATE TO PROJECT DIRECTORY ===
cd /d "C:\Users\Andrew\source\repos\rd1-project-tracker"

REM === DEVELOPMENT MODE ===
if "%MODE%"=="development" (
    echo Starting in DEVELOPMENT mode...
    set NODE_ENV=development
    start "Node Server" cmd /k "npm run dev"
    timeout /t 3 >nul
    start "" "http://localhost:3000/login.html"
    goto :eof
)

REM === PRODUCTION MODE ===
echo Opening PRODUCTION site...
start "" "https://rd1timesheet-axfaghdhctfyguhm.centralus-01.azurewebsites.net/login.html"
