from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List
import os
from pathlib import Path

# Import our services
from app.services.llm_service import LLMService
from app.services.personality_service import PersonalityService
from app.config.settings import Settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="JARVIS AI Assistant",
    description="Open-source personal AI assistant with speech-to-speech capabilities",
    version="0.1.0"
)

# Initialize settings and services
settings = Settings()
llm_service = LLMService(settings)
personality_service = PersonalityService()

# Store active WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")

    async def send_message(self, message: dict, websocket: WebSocket):
        await websocket.send_text(json.dumps(message))

manager = ConnectionManager()

# Serve static files (frontend)
frontend_path = Path(__file__).parent.parent / "frontend" / "web"
if frontend_path.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_path)), name="static")

@app.get("/")
async def get_frontend():
    """Serve the main frontend page"""
    frontend_file = frontend_path / "index.html"
    if frontend_file.exists():
        return HTMLResponse(content=frontend_file.read_text(), status_code=200)
    return {"message": "JARVIS AI Assistant Backend is running! Frontend not found."}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "llm_status": await llm_service.health_check(),
        "version": "0.1.0"
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for real-time communication"""
    await manager.connect(websocket)
    
    # Send welcome message
    welcome_msg = personality_service.get_welcome_message()
    await manager.send_message({
        "type": "assistant_message",
        "content": welcome_msg,
        "timestamp": datetime.now().isoformat()
    }, websocket)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            logger.info(f"Received message: {message_data}")
            
            if message_data.get("type") == "user_message":
                await handle_user_message(message_data, websocket)
            elif message_data.get("type") == "system_command":
                await handle_system_command(message_data, websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except json.JSONDecodeError:
        await manager.send_message({
            "type": "error",
            "content": "Invalid JSON format received"
        }, websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await manager.send_message({
            "type": "error",
            "content": "An error occurred processing your request"
        }, websocket)

async def handle_user_message(message_data: dict, websocket: WebSocket):
    """Process user messages and generate AI responses"""
    user_input = message_data.get("content", "").strip()
    
    if not user_input:
        return
    
    # Send typing indicator
    await manager.send_message({
        "type": "typing",
        "content": "JARVIS is thinking..."
    }, websocket)
    
    try:
        # Add personality context to the user input
        enhanced_prompt = personality_service.enhance_prompt(user_input)
        
        # Generate response using LLM
        response = await llm_service.generate_response(enhanced_prompt)
        
        # Apply personality filter to response
        final_response = personality_service.filter_response(response)
        
        # Send response back to client
        await manager.send_message({
            "type": "assistant_message",
            "content": final_response,
            "timestamp": datetime.now().isoformat()
        }, websocket)
        
    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        error_response = personality_service.get_error_message()
        await manager.send_message({
            "type": "assistant_message",
            "content": error_response,
            "timestamp": datetime.now().isoformat()
        }, websocket)

async def handle_system_command(message_data: dict, websocket: WebSocket):
    """Handle system commands like health checks, settings, etc."""
    command = message_data.get("command", "")
    
    if command == "health":
        health_status = await llm_service.health_check()
        await manager.send_message({
            "type": "system_response",
            "content": f"System Status: {health_status}",
            "timestamp": datetime.now().isoformat()
        }, websocket)
    elif command == "reset":
        await manager.send_message({
            "type": "system_response",
            "content": "Conversation reset. How may I assist you?",
            "timestamp": datetime.now().isoformat()
        }, websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )