@echo off
title RD1 Project Tracker

REM Navigate to the project directory
cd /d "C:\Users\Andrew\source\repos\rd1-project-tracker"

REM Start Node server in a new terminal window
start "Node Server" cmd /k "npm run dev"

REM Wait briefly to let the server start
timeout /t 3 >nul

REM Open login page in default browser
start "" "/login.html"