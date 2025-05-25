from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import httpx
import json
import os

app = FastAPI(title="ARIA Chat Application")

# Enable CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (frontend) from the frontend directory
# Make sure you have a 'frontend' folder in your project root
try:
    app.mount("/static", StaticFiles(directory="frontend"), name="static")
except:
    print("Warning: Frontend directory not found. Make sure 'frontend' folder exists.")

# Pydantic models
class ChatMessage(BaseModel):
    message: str
    model: str = "llama3.2"

class ChatResponse(BaseModel):
    response: str
    status: str

# Ollama configuration
OLLAMA_BASE_URL = "http://localhost:11434"

@app.get("/")
async def serve_frontend():
    """Serve the frontend HTML directly from the backend"""
    try:
        with open("frontend/index.html", "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content)
    except FileNotFoundError:
        return HTMLResponse("""
        <html>
            <head><title>ARIA Setup</title></head>
            <body>
                <h1>ARIA Backend is Running!</h1>
                <p>Backend server is active on port 8000</p>
                <p>Please make sure your frontend files are in the 'frontend' directory</p>
                <ul>
                    <li>Backend API: <a href="/docs">http://127.0.0.1:8000/docs</a></li>
                    <li>Health Check: <a href="/health">http://127.0.0.1:8000/health</a></li>
                </ul>
            </body>
        </html>
        """)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check if Ollama is running
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5.0)
            ollama_status = "connected" if response.status_code == 200 else "disconnected"
    except:
        ollama_status = "disconnected"
    
    return {
        "status": "healthy",
        "backend": "running",
        "ollama": ollama_status,
        "message": "ARIA backend is operational"
    }

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_ollama(chat_message: ChatMessage):
    """Chat endpoint that connects to Ollama"""
    try:
        # Prepare the request to Ollama
        ollama_payload = {
            "model": chat_message.model,
            "prompt": chat_message.message,
            "stream": False
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=ollama_payload
            )
            
            if response.status_code == 200:
                result = response.json()
                return ChatResponse(
                    response=result.get("response", "No response from model"),
                    status="success"
                )
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Ollama API error: {response.text}"
                )
                
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=408,
            detail="Request to Ollama timed out. Make sure Ollama is running with 'ollama serve'"
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Cannot connect to Ollama. Make sure Ollama is running with 'ollama serve'"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.get("/api/models")
async def get_available_models():
    """Get list of available Ollama models"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                return response.json()
            else:
                return {"models": [], "error": "Could not fetch models"}
    except:
        return {"models": [], "error": "Ollama not accessible"}

if __name__ == "__main__":
    import uvicorn
    print("Starting ARIA backend server...")
    print("Make sure Ollama is running: ollama serve")
    print("Access the application at: http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)