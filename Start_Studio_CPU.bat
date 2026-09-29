@echo off
setlocal enabledelayedexpansion
title YuE2 Studio - CPU Mode
cd /d "%~dp0"

echo =======================================================
echo          YuE2 Studio - Uruchamianie w trybie CPU       
echo =======================================================
echo.

:: 1. Szukanie lub tworzenie srodowiska wirtualnego .venv
if not exist ".venv\Scripts\python.exe" (
    echo [INFO] Nie znaleziono lokalnego srodowiska .venv. Tworzenie nowego srodowiska CPU...
    
    set "PY_CMD="
    where py.exe >nul 2>nul && set "PY_CMD=py -3.11"
    if "!PY_CMD!"=="" (
        where python.exe >nul 2>nul && set "PY_CMD=python"
    )
    
    if "!PY_CMD!"=="" (
        echo [BLAD] Nie znaleziono Pythona w systemie! Zainstaluj Python 3.10-3.12.
        pause
        exit /b 1
    )
    
    echo [INFO] Uzywanie interpretera: !PY_CMD!
    !PY_CMD! -m venv .venv
    if errorlevel 1 (
        echo [BLAD] Nie udalo sie utworzyc srodowiska .venv.
        pause
        exit /b 1
    )
    
    echo [INFO] Instalacja zaleznosci CPU z requirements_cpu.txt...
    ".venv\Scripts\python.exe" -m pip install --upgrade pip
    ".venv\Scripts\python.exe" -m pip install -r requirements_cpu.txt
    if errorlevel 1 (
        echo [OSTRZEZENIE] Niektore pakiety mogly sie nie zainstalowac, kontynuuje...
    )
)

:: 2. Uruchomienie YuE2 Studio
echo [INFO] Startowanie serwera YuE2 Studio na http://127.0.0.1:7862 ...
echo [INFO] Wskazowka: Najszybsze generowanie na CPU uzyskasz wybierajac backend GGUF (audio.cpp).
echo.

set "PYTHONPATH=%~dp0src;%PYTHONPATH%"
".venv\Scripts\python.exe" "launch_studio.py" %*

if errorlevel 1 (
    echo.
    echo [BLAD] Aplikacja zakonczyla dzialanie z bledem.
    pause
)
