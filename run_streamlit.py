#!/usr/bin/env python3
"""
Run script for ARIA with Streamlit frontend
"""

import subprocess
import sys
import time
import os
import signal
from pathlib import Path

def run_backend():
    """Start the FastAPI backend"""
    print("🚀 Starting FastAPI backend...")
    backend_cmd = [
        sys.executable, "-m", "uvicorn", 
        "backend.app.main:app", 
        "--host", "127.0.0.1", 
        "--port", "8000", 
        "--reload"
    ]
    return subprocess.Popen(backend_cmd, cwd=".")

def run_frontend():
    """Start the Streamlit frontend"""
    print("🖥️ Starting Streamlit frontend...")
    frontend_cmd = [
        sys.executable, "-m", "streamlit", "run", 
        "streamlit_app.py",
        "--server.port", "8501",
        "--server.address", "127.0.0.1"
    ]
    return subprocess.Popen(frontend_cmd, cwd=".")

def main():
    print("🤖 ARIA AI Assistant - Starting with Streamlit Frontend")
    print("=" * 60)
    
    # Check if required files exist
    if not Path("backend/app/main.py").exists():
        print("❌ Backend not found! Make sure you're in the project root directory.")
        return
    
    if not Path("streamlit_app.py").exists():
        print("❌ Streamlit app not found! Make sure streamlit_app.py exists.")
        return
    
    processes = []
    
    try:
        # Start backend
        backend_process = run_backend()
        processes.append(backend_process)
        
        # Wait a moment for backend to start
        print("⏳ Waiting for backend to initialize...")
        time.sleep(3)
        
        # Start frontend
        frontend_process = run_frontend()
        processes.append(frontend_process)
        
        print("\n" + "=" * 60)
        print("🎉 ARIA is now running!")
        print("📡 Backend API: http://127.0.0.1:8000")
        print("🖥️ Frontend UI: http://127.0.0.1:8501")
        print("📚 API Docs: http://127.0.0.1:8000/docs")
        print("=" * 60)
        print("Press Ctrl+C to stop all services")
        
        # Wait for processes
        while True:
            time.sleep(1)
            # Check if any process died
            for p in processes:
                if p.poll() is not None:
                    print(f"⚠️ Process {p.pid} died, restarting...")
                    break
            
    except KeyboardInterrupt:
        print("\n🛑 Shutting down ARIA...")
        
    finally:
        # Clean up processes
        for process in processes:
            try:
                if process.poll() is None:
                    process.terminate()
                    process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            except:
                pass
        
        print("✅ All services stopped. Goodbye!")

if __name__ == "__main__":
    main()