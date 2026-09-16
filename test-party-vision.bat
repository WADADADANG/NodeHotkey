@echo off
chcp 65001 >nul
title NodeHotkey - Party Vision Diagnostic Test
echo ===============================================================
echo        NodeHotkey Party Vision Diagnostic Benchmark
echo ===============================================================
echo.
node test/vision_party.test.js --all
echo.
pause
