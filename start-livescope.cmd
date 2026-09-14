@echo off
setlocal
cd /d "%~dp0"
set "LIVESCOPE_NODE=node"
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "LIVESCOPE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%LIVESCOPE_NODE%" scripts/dev-live.mjs
if errorlevel 1 pause
