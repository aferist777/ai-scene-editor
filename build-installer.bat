@echo off
setlocal

if not exist node_modules (
  echo Node modules not found. Please run install-dependencies.bat first.
  exit /b 1
)

echo Building Windows installer...
call npm run package:win
if errorlevel 1 (
  echo.
  echo Failed to build the Windows installer.
  exit /b %errorlevel%
)

echo.
echo Windows installer created successfully in the release folder.
endlocal
