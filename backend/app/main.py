import sys
import os
sys.path.append(os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse

from pydantic import BaseModel
import httpx
import json
import os
import random
import re
from datetime import datetime
from typing import Optional, Dict, Any, List
import logging

from services.llm_service import LLMService
from services.personality_service import PersonalityService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

# Configuration
OLLAMA_BASE_URL = "http://localhost:11434"

# Global conversation state and services
conversation_history = []
MAX_HISTORY = 10

# Settings object for services
class Settings:
    OLLAMA_BASE_URL = OLLAMA_BASE_URL
    OLLAMA_MODEL = "llama3.2"

settings = Settings()

# Initialize services
llm_service = LLMService(settings)
personality_service = PersonalityService()

# ================== ENDPOINTS ==================

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
    
# Add specific routes for CSS and JS files (direct access without /static prefix)
@app.get("/styles.css")
async def serve_css():
    """Serve the CSS file directly"""
    try:
        return FileResponse("frontend/styles.css", media_type="text/css")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="CSS file not found")

@app.get("/script.js")
async def serve_js():
    """Serve the JavaScript file directly"""
    try:
        return FileResponse("frontend/script.js", media_type="application/javascript")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="JavaScript file not found")

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
        "message": "ARIA backend is operational",
        "conversation_history_length": len(conversation_history)
    }

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_ollama(chat_message: ChatMessage):
    """Enhanced chat endpoint with personality and conversation history"""
    try:
        # Check for capability queries first
        capability_keywords = ['what can you do', 'capabilities', 'features', 'help', 'speak', 'voice', 'calendar', 'search', 'document']
        if any(keyword in chat_message.message.lower() for keyword in capability_keywords):
            capability_response = personality_service.handle_capability_query(chat_message.message)
            if capability_response != chat_message.message:  # If we got a capability response
                return ChatResponse(
                    response=capability_response,
                    status="success"
                )
        
        # Enhance the prompt with personality and context
        enhanced_prompt = personality_service.enhance_prompt(chat_message.message)
        
        # Build conversation context with history
        messages = build_conversation_context(enhanced_prompt)
        
        # Prepare the request to Ollama with enhanced context
        ollama_payload = {
            "model": chat_message.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
                "max_tokens": 512,
                "stop": ["Human:", "User:"],
            }
        }
        
        logger.info(f"Sending enhanced request to Ollama: {chat_message.model}")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json=ollama_payload
            )
            
            if response.status_code == 200:
                result = response.json()
                raw_response = result.get("message", {}).get("content", "No response from model")
                
                # Apply personality filtering and enhancement
                enhanced_response = personality_service.filter_response(raw_response)
                
                # Update conversation history
                update_conversation_history(chat_message.message, enhanced_response)
                
                return ChatResponse(
                    response=enhanced_response,
                    status="success"
                )
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Ollama API error: {response.text}"
                )
                
    except httpx.TimeoutException:
        error_msg = personality_service.get_error_message() + " (Request timed out - make sure Ollama is running with 'ollama serve')"
        raise HTTPException(status_code=408, detail=error_msg)
    except httpx.ConnectError:
        error_msg = personality_service.get_error_message() + " (Cannot connect to Ollama - make sure it's running with 'ollama serve')"
        raise HTTPException(status_code=503, detail=error_msg)
    except Exception as e:
        error_msg = personality_service.get_error_message() + f" (Technical details: {str(e)})"
        raise HTTPException(status_code=500, detail=error_msg)

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

@app.get("/api/welcome")
async def get_welcome():
    """Get a random welcome message"""
    return {"message": personality_service.get_welcome_message()}

@app.post("/api/clear-history")
async def clear_conversation_history():
    """Clear conversation history"""
    global conversation_history
    conversation_history = []
    return {"message": "Conversation history cleared", "status": "success"}

@app.get("/api/conversation-stats")
async def get_conversation_stats():
    """Get conversation statistics"""
    return {
        "total_exchanges": len(conversation_history),
        "max_history": MAX_HISTORY,
        "oldest_message": conversation_history[0]["timestamp"] if conversation_history else None,
        "newest_message": conversation_history[-1]["timestamp"] if conversation_history else None
    }

# ================== HELPER FUNCTIONS ==================

def build_conversation_context(current_prompt: str) -> list:
    """Build conversation context with history"""
    messages = [{"role": "system", "content": personality_service.get_system_prompt()}]
    
    # Add conversation history
    for exchange in conversation_history[-MAX_HISTORY:]:
        messages.extend([
            {"role": "user", "content": exchange["user"]},
            {"role": "assistant", "content": exchange["assistant"]},
        ])
    
    # Add current prompt
    messages.append({"role": "user", "content": current_prompt})
    
    return messages

def update_conversation_history(user_input: str, assistant_response: str):
    """Update conversation history for context"""
    global conversation_history
    
    conversation_history.append({
        "user": user_input,
        "assistant": assistant_response,
        "timestamp": datetime.now().isoformat(),
    })
    
    # Trim history if it gets too long
    if len(conversation_history) > MAX_HISTORY:
        conversation_history = conversation_history[-MAX_HISTORY:]

if __name__ == "__main__":
    import uvicorn
    print("Starting enhanced ARIA backend server...")
    print("Make sure Ollama is running: ollama serve")
    print("Access the application at: http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)