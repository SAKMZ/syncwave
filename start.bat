@echo off
setlocal
cd /d "%~dp0"

rem Syncwave launcher for Windows. Double-click this file.
rem The real work happens in scripts\launch.mjs — this only has to find Node and
rem keep the window open long enough to read an error.

where node >nul 2>nul
if errorlevel 1 goto no_node

node "scripts\launch.mjs" %*
set EXITCODE=%errorlevel%

if not "%EXITCODE%"=="0" (
  echo.
  echo Syncwave stopped with an error ^(code %EXITCODE%^).
  echo.
  pause
)
exit /b %EXITCODE%

:no_node
echo.
echo   Syncwave needs Node.js, which does not appear to be installed.
echo.
echo   Install the LTS version from:  https://nodejs.org
echo   Then double-click this file again.
echo.
echo   If you have winget, this works too:
echo       winget install OpenJS.NodeJS.LTS
echo.
pause
exit /b 1
