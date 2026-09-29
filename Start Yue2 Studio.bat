@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

:: 1. Check parent YuE2 environment
if exist "..\.venv\Scripts\python.exe" (
    if exist "install_studio.py" (
        "..\.venv\Scripts\python.exe" "install_studio.py"
        if errorlevel 1 (
            pause
            exit /b 1
        )
    )
    "..\.venv\Scripts\python.exe" "launch_studio.py" %*
    if errorlevel 1 pause
    exit /b 0
)

:: 2. Check local venv or forward to Start_Studio_CPU.bat
if exist ".venv\Scripts\python.exe" (
    set "PYTHONPATH=%~dp0src;%PYTHONPATH%"
    ".venv\Scripts\python.exe" "launch_studio.py" %*
    if errorlevel 1 pause
    exit /b 0
)

:: 3. Run CPU startup script
call "Start_Studio_CPU.bat" %*
