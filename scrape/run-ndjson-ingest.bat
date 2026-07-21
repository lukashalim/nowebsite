@echo off
setlocal EnableExtensions

REM Ingest Google Maps Extractor NDJSON cache into Supabase.
REM Schedule with Windows Task Scheduler (Action: Start this .bat).
REM Requires .env.local in scrape\ or repo root (Supabase keys).
REM
REM Optional env before run:
REM   set NODE_EXE=C:\Program Files\nodejs\node.exe
REM
REM Uses `node --import tsx` so scrape can load src/ TypeScript that uses @/ path aliases
REM (see business-payload-from-raw.mjs → resolve-category-slug.ts).
REM
REM Extra flags are passed through, e.g.:
REM   run-ndjson-ingest.bat --business-type "Plumber" --include-tasks
REM   set EXTRACT_LOCAL_COUNTRY=GB
REM   set EXTRACT_LOCAL_LOCATION_HINT=M1 1AA
REM   run-ndjson-ingest.bat --business-type "Plumber"

if not defined NODE_EXE set "NODE_EXE=node"

set "SCRAPE_DIR=%~dp0"
if "%SCRAPE_DIR:~-1%"=="\" set "SCRAPE_DIR=%SCRAPE_DIR:~0,-1%"
set "REPO_ROOT=%SCRAPE_DIR%\.."
set "LOG_DIR=%SCRAPE_DIR%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set "STAMP=%%i"
set "LOG_FILE=%LOG_DIR%\ndjson-ingest_%STAMP%.log"

cd /d "%REPO_ROOT%" || (
  echo Failed to cd to %REPO_ROOT%>> "%LOG_FILE%"
  exit /b 1
)

echo [%date% %time%] Starting NDJSON ingest %* >> "%LOG_FILE%"
"%NODE_EXE%" --import tsx ./scrape/extract-local-extractor-cache.mjs %* >> "%LOG_FILE%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"
echo [%date% %time%] Finished exit code %EXIT_CODE% >> "%LOG_FILE%"

exit /b %EXIT_CODE%
