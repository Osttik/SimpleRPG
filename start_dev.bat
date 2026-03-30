@echo off
set PROJECT_ROOT=%CD%

cd /d D:\Projects\Tools\emsdk
call emsdk.bat activate latest >nul
call emsdk_env.bat >nul

cd /d %PROJECT_ROOT%

echo [Builder] Emscripten environment active.
%*