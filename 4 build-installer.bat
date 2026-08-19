@echo off
title NodeHotkey - Installer Builder
cd /d "%~dp0"

echo ========================================================
echo       NodeHotkey Standalone Installer Builder
echo ========================================================
echo.

node build-installer.js
if %errorlevel% neq 0 (
    echo [ERROR] Packaging failed!
    pause
    exit /b %errorlevel%
)

echo --------------------------------------------------------
echo Checking for Inno Setup Compiler (ISCC.exe)...
echo --------------------------------------------------------

set "ISCC_EXE="
if exist "C:\Program Files\Inno Setup 7\ISCC.exe" set "ISCC_EXE=C:\Program Files\Inno Setup 7\ISCC.exe"
if exist "C:\Program Files (x86)\Inno Setup 7\ISCC.exe" set "ISCC_EXE=C:\Program Files (x86)\Inno Setup 7\ISCC.exe"
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC_EXE=C:\Program Files\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC_EXE=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if exist "%LocalAppData%\Programs\Inno Setup 7\ISCC.exe" set "ISCC_EXE=%LocalAppData%\Programs\Inno Setup 7\ISCC.exe"
if exist "%LocalAppData%\Programs\Inno Setup 6\ISCC.exe" set "ISCC_EXE=%LocalAppData%\Programs\Inno Setup 6\ISCC.exe"

where iscc >nul 2>nul
if %errorlevel% equ 0 if not defined ISCC_EXE set "ISCC_EXE=iscc"

if defined ISCC_EXE (
    echo [INFO] Found Inno Setup Compiler! Compiling installer.iss...
    "%ISCC_EXE%" installer.iss
    echo.
    if exist "dist\NodeHotkey-Setup-v3.0.0.exe" (
        echo ========================================================
        echo  SUCCESS! Standalone Installer Generated:
        echo  dist\NodeHotkey-Setup-v3.0.0.exe
        echo ========================================================
        echo.
        explorer dist
    ) else (
        echo [ERROR] Setup file was not found.
    )
) else (
    echo.
    echo [NOTE] Inno Setup is not installed on this PC yet.
    echo --------------------------------------------------------
    echo 1. The standalone folder is READY at: "dist\NodeHotkey"
    echo.
    echo 2. To compile into a single "NodeHotkey-Setup.exe" file:
    echo    Install Inno Setup 7/6 then run this script again!
    echo --------------------------------------------------------
    echo.
    explorer dist
)

pause
