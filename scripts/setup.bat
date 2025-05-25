@echo off
echo ========================================
echo         ARIA Application Startup
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python and try again
    pause
    exit /b 1
)

REM Check if Ollama is available
ollama --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Ollama is not installed or not in PATH
    echo Please install Ollama from https://ollama.ai
    pause
    exit /b 1
)

echo Starting Ollama server...
start /b ollama serve

echo Waiting for Ollama to start...
timeout /t 5 /nobreak >nul

echo.
echo Starting ARIA backend server...
echo Server will be available at: http://127.0.0.1:8000
echo Press Ctrl+C to stop the server
echo.

REM Start the FastAPI server
if exist "app\main.py" (
    python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
) else if exist "main.py" (
    python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
) else (
    echo ERROR: Could not find main.py or app\main.py
    echo Please ensure your FastAPI application is properly set up
    pause
    exit /b 1
)

pause