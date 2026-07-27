@echo off
setlocal
cd /d "%~dp0"

rem Syncwave launcher for Windows. Double-click this file.
rem   start.bat            start it, and print a public link to share
rem   start.bat --local    stay on the local network, no public link
rem   start.bat --rebuild  force a rebuild first
rem
rem The real work happens in scripts\launch.mjs. All this has to do is produce a
rem Node new enough to run it - preferring an installed one, and otherwise
rem fetching a private copy into .runtime\node - then keep the window open long
rem enough to read an error.

call :probe
if defined NODE_OK goto run

rem Nothing usable is installed. Put our own copy first on PATH, which also makes
rem npm resolve to the matching one, and see whether a previous run left it there.
set "PATH=%CD%\.runtime\node;%PATH%"
call :probe
if defined NODE_OK goto run

echo.
echo   Syncwave needs Node.js and couldn't find it, so it will download a
echo   private copy ^(about 30 MB^) into the .runtime folder next to this file.
echo.
echo   Nothing is installed system-wide and no settings are changed.
echo   Deleting .runtime undoes it completely.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\get-node.ps1"
if errorlevel 1 goto no_node

call :probe
if not defined NODE_OK goto no_node

:run
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
echo   Syncwave could not set up Node.js automatically.
echo.
echo   Install the LTS version yourself and double-click this file again:
echo       https://nodejs.org
echo.
echo   Or, if you have winget:
echo       winget install OpenJS.NodeJS.LTS
echo.
pause
exit /b 1

rem ---------------------------------------------------------------------------
rem Sets NODE_OK when `node` on the current PATH is version 20 or newer. Probing
rem by name rather than by path keeps this free of quoting problems, and the
rem caller controls which Node that is by ordering PATH.
:probe
set "NODE_OK="
set "_v="
for /f "delims=" %%v in ('node -v 2^>nul') do set "_v=%%v"
if not defined _v exit /b 0
set "_v=%_v:v=%"
for /f "tokens=1 delims=." %%m in ("%_v%") do set "_m=%%m"
if not defined _m exit /b 0
if %_m% GEQ 20 set "NODE_OK=1"
exit /b 0
