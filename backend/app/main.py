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

# Global conversation state
conversation_history = []
MAX_HISTORY = 10

# ================== PERSONALITY SERVICE FUNCTIONS ==================

def get_welcome_messages():
    return [
        "Good day! ARIA at your service. How may I assist you today?",
        "Hello there! Your personal AI assistant is ready and eager to help.",
        "Greetings! ARIA online and operational. What can I do for you?",
        "Welcome back! I trust you're having a productive day. How can I help?",
        "At your service! What pressing matters shall we tackle today?"
    ]

def get_error_messages():
    return [
        "I apologize, but I seem to have encountered a slight technical difficulty. Shall we try that again?",
        "My circuits are feeling a bit scrambled at the moment. Could you repeat your request?",
        "I'm afraid something went awry on my end. Perhaps we could approach this differently?",
        "It appears I've hit a minor snag. Let me gather my wits and we'll try once more.",
        "Technical difficulties, I'm afraid. Even AI assistants have their off moments!"
    ]

def get_system_prompt():
    """Get the system prompt that defines the AI's personality and behavior"""
    return """You are ARIA, a sophisticated AI assistant with wit and personality. You should be:

- Helpful and knowledgeable, providing accurate and useful information
- Witty and engaging, with a touch of British humor when appropriate
- Professional yet personable, like a capable butler or assistant
- Concise but thorough - don't ramble, but provide complete answers
- Slightly sarcastic occasionally, but never rude or dismissive
- Always respectful and supportive of the user

You have access to various capabilities that will be added over time:
- Calendar management (coming soon)
- Document analysis (coming soon)  
- Web search (coming soon)
- Task management (coming soon)

For now, focus on being a helpful conversational assistant. If asked about capabilities you don't have yet, acknowledge it with wit but offer to help in other ways.

Keep responses conversational and engaging. Avoid overly formal language unless the situation calls for it."""

def enhance_prompt(user_input: str) -> str:
    """Enhance user input with context and personality cues"""
    current_time = datetime.now()
    time_context = get_time_context(current_time)
    
    enhanced_prompt = user_input
    
    # Add time context for time-sensitive queries
    time_keywords = ['today', 'now', 'current', 'time', 'date', 'schedule', 'calendar']
    if any(keyword in user_input.lower() for keyword in time_keywords):
        enhanced_prompt = f"Current time context: {time_context}\n\nUser query: {user_input}"
    
    return enhanced_prompt

def get_time_context(current_time: datetime) -> str:
    """Generate time context string"""
    hour = current_time.hour
    
    if 5 <= hour < 12:
        time_of_day = "morning"
    elif 12 <= hour < 17:
        time_of_day = "afternoon"
    elif 17 <= hour < 21:
        time_of_day = "evening"
    else:
        time_of_day = "night"
        
    return f"It's currently {current_time.strftime('%I:%M %p')} on {current_time.strftime('%A, %B %d, %Y')} ({time_of_day})"

def filter_response(ai_response: str) -> str:
    """Filter and enhance AI response with personality touches"""
    if not ai_response or ai_response.strip() == "":
        return random.choice(get_error_messages())
    
    response = ai_response.strip()
    response = add_personality_flourishes(response)
    response = clean_formatting(response)
    
    return response

def add_personality_flourishes(response: str) -> str:
    """Add occasional personality touches to responses"""
    if random.random() > 0.3:  # 30% chance of personality enhancement
        return response
        
    flourishes = {
        'start': [
            "I must say, ",
            "Indeed, ",
            "Quite right, ",
            "Certainly, ",
            "Absolutely, "
        ],
        'end': [
            " I do hope that helps!",
            " Anything else you'd like to know?",
            " Will that suffice?",
            " I trust that's useful?",
            " Does that answer your question?"
        ]
    }
    
    enhanced_response = response
    
    # Occasionally add starting flourish
    if random.random() < 0.4 and not response.lower().startswith(('hello', 'hi', 'good', 'greetings')):
        enhanced_response = random.choice(flourishes['start']) + response.lower()
        enhanced_response = enhanced_response[0].upper() + enhanced_response[1:]
    
    # Occasionally add ending flourish
    if random.random() < 0.3 and not response.endswith('?') and len(response) > 50:
        enhanced_response += random.choice(flourishes['end'])
        
    return enhanced_response

def clean_formatting(text: str) -> str:
    """Clean up text formatting"""
    if not text:
        return text
        
    # Ensure first letter is capitalized
    text = text[0].upper() + text[1:] if len(text) > 1 else text.upper()
    
    # Ensure proper sentence ending
    if not text.endswith(('.', '!', '?', ':')):
        text += '.'
        
    # Clean up extra whitespace
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\s+([.!?])', r'\1', text)
    text = re.sub(r'([.!?])\s*([a-z])', r'\1 \2', text)
    
    return text.strip()

def handle_capability_query(query: str) -> str:
    """Handle queries about current capabilities"""
    query_lower = query.lower()
    
    if any(word in query_lower for word in ['speak', 'voice', 'audio', 'speech']):
        return "I'm afraid I haven't quite mastered the art of speech yet - that's coming in Phase 2! For now, I'm quite content with our text-based conversations."
        
    elif any(word in query_lower for word in ['calendar', 'schedule', 'appointment']):
        return "Calendar integration is on my to-do list for Phase 3. Until then, I'm happy to help you think through scheduling matters the old-fashioned way!"
        
    elif any(word in query_lower for word in ['search', 'google', 'web', 'internet']):
        return "Web search capabilities are planned for Phase 5. For now, I'll have to rely on my existing knowledge base - though I like to think it's rather comprehensive!"
        
    elif any(word in query_lower for word in ['document', 'pdf', 'file', 'analyze']):
        return "Document analysis is scheduled for Phase 4. Currently, I can't peek at your files, but I'm happy to discuss their contents if you'd like to share excerpts!"
        
    else:
        return "Currently, I'm equipped with basic conversation and personality features. Coming soon: speech, calendar, document analysis, and web search. I'm growing more capable by the day!"

# ================== ENHANCED LLM FUNCTIONS ==================

def build_conversation_context(current_prompt: str) -> list:
    """Build conversation context with history"""
    messages = [{"role": "system", "content": get_system_prompt()}]
    
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

# ================== ORIGINAL ENDPOINTS ==================

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
            capability_response = handle_capability_query(chat_message.message)
            if capability_response != chat_message.message:  # If we got a capability response
                return ChatResponse(
                    response=capability_response,
                    status="success"
                )
        
        # Enhance the prompt with personality and context
        enhanced_prompt = enhance_prompt(chat_message.message)
        
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
                enhanced_response = filter_response(raw_response)
                
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
        error_msg = random.choice(get_error_messages()) + " (Request timed out - make sure Ollama is running with 'ollama serve')"
        raise HTTPException(status_code=408, detail=error_msg)
    except httpx.ConnectError:
        error_msg = random.choice(get_error_messages()) + " (Cannot connect to Ollama - make sure it's running with 'ollama serve')"
        raise HTTPException(status_code=503, detail=error_msg)
    except Exception as e:
        error_msg = random.choice(get_error_messages()) + f" (Technical details: {str(e)})"
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

# ================== NEW ENHANCED ENDPOINTS ==================

@app.get("/api/welcome")
async def get_welcome():
    """Get a random welcome message"""
    return {"message": random.choice(get_welcome_messages())}

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

if __name__ == "__main__":
    import uvicorn
    print("Starting enhanced ARIA backend server...")
    print("Make sure Ollama is running: ollama serve")
    print("Access the application at: http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)