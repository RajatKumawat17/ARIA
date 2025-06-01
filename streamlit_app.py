import streamlit as st
import requests
import json
import io
import asyncio
import aiohttp
from audio_recorder_streamlit import audio_recorder
import time

# Configure Streamlit page
st.set_page_config(
    page_title="ARIA AI Assistant",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Backend API URL
BACKEND_URL = "http://127.0.0.1:8000"

# Initialize session state
if "messages" not in st.session_state:
    st.session_state.messages = []
if "backend_status" not in st.session_state:
    st.session_state.backend_status = "unknown"

def check_backend_status():
    """Check if backend is running"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            return health_data
        else:
            return {"status": "error", "backend": "unreachable"}
    except requests.RequestException:
        return {"status": "error", "backend": "unreachable"}

def send_chat_message(message: str, model: str = "llama3.2"):
    """Send chat message to backend"""
    try:
        payload = {
            "message": message,
            "model": model
        }
        response = requests.post(
            f"{BACKEND_URL}/api/chat",
            json=payload,
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {
                "response": f"Error: {response.status_code} - {response.text}",
                "status": "error"
            }
    except requests.RequestException as e:
        return {
            "response": f"Connection error: {str(e)}",
            "status": "error"
        }

def transcribe_audio(audio_bytes):
    """Transcribe audio using backend"""
    try:
        files = {"audio": ("audio.wav", audio_bytes, "audio/wav")}
        response = requests.post(
            f"{BACKEND_URL}/api/speech/transcribe",
            files=files,
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {
                "transcription": "",
                "status": "error",
                "error": f"HTTP {response.status_code}"
            }
    except requests.RequestException as e:
        return {
            "transcription": "",
            "status": "error",
            "error": str(e)
        }

def get_available_models():
    """Get available Ollama models"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/models", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "models" in data and data["models"]:
                return [model["name"] for model in data["models"]]
        return ["llama3.2:3b"]  # Default fallback
    except:
        return ["llama3.2:3b"]

def main():
    # Header
    st.title("🤖 ARIA AI Assistant")
    st.markdown("*Your intelligent assistant with voice capabilities*")
    
    # Sidebar
    with st.sidebar:
        st.header("Settings")
        
        # Backend status
        health = check_backend_status()
        if health["status"] == "healthy":
            st.success("✅ Backend Connected")
            st.info(f"Ollama: {health.get('ollama', 'unknown')}")
            st.info(f"Speech: {health.get('speech_service', 'unknown')}")
        else:
            st.error("❌ Backend Disconnected")
            st.warning("Make sure the backend server is running on port 8000")
        
        # Model selection
        available_models = get_available_models()
        selected_model = st.selectbox(
            "AI Model",
            available_models,
            index=0 if available_models else None
        )
        
        # Clear conversation
        if st.button("🗑️ Clear Conversation"):
            st.session_state.messages = []
            # Clear backend history too
            try:
                requests.post(f"{BACKEND_URL}/api/clear-history")
            except:
                pass
            st.rerun()
        
        # Welcome message
        if st.button("👋 Get Welcome Message"):
            try:
                response = requests.get(f"{BACKEND_URL}/api/welcome")
                if response.status_code == 200:
                    welcome_msg = response.json()["message"]
                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": welcome_msg
                    })
                    st.rerun()
            except:
                pass
    
    # Main chat interface
    st.header("💬 Chat")
    
    # Display chat messages
    chat_container = st.container()
    with chat_container:
        for message in st.session_state.messages:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])
    
    # Input section
    st.header("📝 Input")
    
    # Create columns for text input and voice input
    col1, col2 = st.columns([4, 1])
    
    with col1:
        # Text input
        text_input = st.chat_input("Type your message here...")
    
    with col2:
        st.markdown("##### 🎤 Voice")
        # Audio recorder
        audio_bytes = audio_recorder(
            text="🎙️",
            recording_color="#e74c3c",
            neutral_color="#3498db",
            icon_name="microphone",
            icon_size="2x",
            key="audio_recorder"
        )
    
    # Process text input
    if text_input:
        # Add user message to chat
        st.session_state.messages.append({
            "role": "user", 
            "content": text_input
        })
        
        # Get AI response
        with st.spinner("🤔 Thinking..."):
            response_data = send_chat_message(text_input, selected_model)
            
            # Add assistant response to chat
            st.session_state.messages.append({
                "role": "assistant",
                "content": response_data["response"]
            })
        
        st.rerun()
    
    # Process voice input
    if audio_bytes:
        st.success("🎵 Audio recorded! Processing...")
        
        # Transcribe audio
        with st.spinner("🎧 Transcribing audio..."):
            transcription_result = transcribe_audio(audio_bytes)
            
            if transcription_result["status"] == "success":
                transcribed_text = transcription_result["transcription"]
                
                if transcribed_text.strip():
                    st.info(f"🗣️ You said: *{transcribed_text}*")
                    
                    # Add transcribed message to chat
                    st.session_state.messages.append({
                        "role": "user",
                        "content": transcribed_text
                    })
                    
                    # Get AI response
                    with st.spinner("🤔 Processing your voice command..."):
                        response_data = send_chat_message(transcribed_text, selected_model)
                        
                        # Add assistant response to chat
                        st.session_state.messages.append({
                            "role": "assistant", 
                            "content": response_data["response"]
                        })
                    
                    st.rerun()
                else:
                    st.warning("No speech detected. Please try again.")
            else:
                st.error(f"❌ Transcription failed: {transcription_result.get('error', 'Unknown error')}")
    
    # Footer
    st.markdown("---")
    col1, col2, col3 = st.columns(3)
    
    with col1:
        if st.session_state.messages:
            st.metric("Messages", len(st.session_state.messages))
    
    with col2:
        st.metric("Model", selected_model)
    
    with col3:
        status_color = "🟢" if health["status"] == "healthy" else "🔴"
        st.metric("Status", f"{status_color} {health['status'].title()}")

if __name__ == "__main__":
    main()