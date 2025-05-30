import sys
import os
sys.path.append(os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from starlette.responses import Response

from pydantic import BaseModel
import httpx
import json
import os
import io
import random
import re
from datetime import datetime
from typing import Optional, Dict, Any, List
import logging

from services.llm_service import LLMService
from services.personality_service import PersonalityService
from services.speech_service import SpeechService
from config.settings import Settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ARIA Chat Application with Speech")

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

class SpeechMode(BaseModel):
    enabled: bool

# Global state
conversation_history = []
MAX_HISTORY = 10
current_mode = "voice"  # Start with voice mode

# Initialize settings and services
settings = Settings()
llm_service = LLMService(settings)
personality_service = PersonalityService()
speech_service = SpeechService(settings)

# Initialize speech service on startup
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    try:
        if settings.ENABLE_SPEECH:
            await speech_service.initialize()
            logger.info("Speech service initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize speech service: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    try:
        await speech_service.cleanup()
        await llm_service.close()
    except Exception as e:
        logger.error(f"Shutdown error: {str(e)}")

# ================== SPEECH ENDPOINTS ==================

@app.post("/api/speech/process")
async def process_speech(audio: UploadFile = File(...)):
    """Process speech-to-speech interaction"""
    if not settings.ENABLE_SPEECH:
        raise HTTPException(status_code=400, detail="Speech features are disabled")
    
    try:
        # Read audio data
        audio_data = await audio.read()
        
        # Process through speech-to-speech pipeline
        response_text, response_audio = await speech_service.process_speech_to_speech(
            audio_data, llm_service, personality_service
        )
        
        # Check if mode switch was requested
        mode_switch = speech_service.detect_mode_switch(response_text)
        if mode_switch == "chat":
            global current_mode
            current_mode = "chat"
        
        # Update conversation history
        # Note: We'll need the original transcription for this
        # For now, we'll use the response text as a placeholder
        update_conversation_history("Voice input", response_text)
        
        # Return audio response
        return StreamingResponse(
            io.BytesIO(response_audio),
            media_type="audio/wav",
            headers={
                "X-Response-Text": response_text,
                "X-Mode-Switch": mode_switch or "",
            }
        )
        
    except Exception as e:
        logger.error(f"Speech processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Speech processing failed: {str(e)}")

@app.post("/api/speech/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe audio to text"""
    if not settings.ENABLE_SPEECH:
        raise HTTPException(status_code=400, detail="Speech features are disabled")
    
    try:
        audio_data = await audio.read()
        transcription = await speech_service.transcribe_audio(audio_data)
        
        return {"transcription": transcription, "status": "success"}
        
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@app.post("/api/speech/synthesize")
async def synthesize_speech(text: str = Form(...), voice: str = Form("default")):
    """Synthesize text to speech"""
    if not settings.ENABLE_SPEECH:
        raise HTTPException(status_code=400, detail="Speech features are disabled")
    
    try:
        audio_data = await speech_service.synthesize_speech(text, voice)
        
        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type="audio/wav"
        )
        
    except Exception as e:
        logger.error(f"Speech synthesis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Speech synthesis failed: {str(e)}")

@app.get("/api/speech/status")
async def get_speech_status():
    """Get speech service status"""
    return {
        "enabled": settings.ENABLE_SPEECH,
        "initialized": speech_service.is_initialized,
        "whisper_model": settings.STT_MODEL,
        "kokoro_available": speech_service.kokoro_path is not None,
        "current_mode": current_mode
    }

@app.post("/api/mode/switch")
async def switch_mode(mode: str = Form(...)):
    """Switch between voice and chat modes"""
    global current_mode
    
    if mode not in ["voice", "chat"]:
        raise HTTPException(status_code=400, detail="Invalid mode. Use 'voice' or 'chat'")
    
    current_mode = mode
    
    return {
        "mode": current_mode,
        "message": f"Switched to {mode} mode",
        "status": "success"
    }

@app.get("/api/mode/current")
async def get_current_mode():
    """Get current interaction mode"""
    return {
        "mode": current_mode,
        "speech_enabled": settings.ENABLE_SPEECH
    }

# ================== EXISTING ENDPOINTS (PRESERVED) ==================

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
                    <li>Speech Status: <a href="/api/speech/status">http://127.0.0.1:8000/api/speech/status</a></li>
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
            response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5.0)
            ollama_status = "connected" if response.status_code == 200 else "disconnected"
    except:
        ollama_status = "disconnected"
    
    return {
        "status": "healthy",
        "backend": "running",
        "ollama": ollama_status,
        "speech_service": speech_service.is_initialized if settings.ENABLE_SPEECH else "disabled",
        "current_mode": current_mode,
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
        
        # Check for mode switch in chat
        mode_switch = speech_service.detect_mode_switch(chat_message.message) if settings.ENABLE_SPEECH else None
        if mode_switch == "voice":
            global current_mode
            current_mode = "voice"
            return ChatResponse(
                response="Switching to voice mode. You can now speak to me!",
                status="success"
            )
        
        # Enhance the prompt with personality and context
        enhanced_prompt = personality_service.enhance_prompt(chat_message.message)
        
        # Build conversation context with history
        messages = build_conversation_context(enhanced_prompt)
        
        # Generate response using LLM service
        response = await llm_service.generate_response(
            enhanced_prompt,
            conversation_context=messages
        )
        
        # Apply personality filtering
        enhanced_response = personality_service.filter_response(response)
        
        # Update conversation history
        update_conversation_history(chat_message.message, enhanced_response)
        
        return ChatResponse(
            response=enhanced_response,
            status="success"
        )
                
    except Exception as e:
        error_msg = personality_service.get_error_message() + f" (Technical details: {str(e)})"
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/api/models")
async def get_available_models():
    """Get list of available Ollama models"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
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
        "newest_message": conversation_history[-1]["timestamp"] if conversation_history else None,
        "current_mode": current_mode
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
    print("Starting enhanced ARIA backend server with speech support...")
    print("Make sure Ollama is running: ollama serve")
    print("Make sure Whisper is installed: pip install openai-whisper")
    print("Make sure Kokoro TTS is set up (optional - will fallback to espeak)")
    print("Access the application at: http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)