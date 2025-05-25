@echo off
echo Setting up ARIA - AI Personal Assistant...

REM Check if Python is installed
python --version
if %errorlevel% neq 0 (
    echo Python is not installed or not in PATH
    exit /b 1
)

REM Check if Ollama is installed
ollama --version
if %errorlevel% neq 0 (
    echo Ollama is not installed
    exit /b 1
)

REM Create data directories
if not exist "data\documents" mkdir data\documents
if not exist "data\conversations" mkdir data\conversations  
if not exist "data\models" mkdir data\models
