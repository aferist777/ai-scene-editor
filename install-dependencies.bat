@echo off
setlocal

echo Installing npm dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo Failed to install project dependencies.
  exit /b %errorlevel%
)

echo.
echo Dependencies installed successfully.
echo Configure your Gemini API key before running the editor or packaging the app.
echo You can create a .env.local file with GEMINI_API_KEY=your_key or set the GEMINI_API_KEY/API_KEY environment variable.

echo.
echo Done.
endlocal
