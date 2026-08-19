@echo off
chcp 65001 > nul
cd /d "%~dp0"
if exist "%~dp0node_modules\electron\dist\electron.exe" (
    start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0launcher\main.js"
) else (
    start "" npx electron launcher/main.js
)
exit
