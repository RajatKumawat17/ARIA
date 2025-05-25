import os
from pathlib import Path
from typing import Optional

class Settings:
    """Application settings with environment variable support"""
    
    def __init__(self):
        # Load from environment variables or use defaults
        
        # Server Configuration
        self.HOST: str = os.getenv("HOST", "127.0.0.1")
        self.PORT: int = int(os.getenv("PORT", "8000"))
        self.DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
        
        # Ollama Configuration
        self.OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
        
        # Database Configuration
        self.DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/jarvis.db")
        
        # Vector Database (ChromaDB)
        self.CHROMA_PERSIST_DIRECTORY: str = os.getenv("CHROMA_PERSIST_DIRECTORY", "./data/chroma")
        
        # File Storage
        self.DOCUMENTS_DIR: str = os.getenv("DOCUMENTS_DIR", "./data/documents")
        self.MODELS_DIR: str = os.getenv("MODELS_DIR", "./data/models")
        self.CONVERSATIONS_DIR: str = os.getenv("CONVERSATIONS_DIR", "./data/conversations")
        
        # Speech Configuration (for future phases)
        self.STT_MODEL: str = os.getenv("STT_MODEL", "base")  # Whisper model size
        self.TTS_ENGINE: str = os.getenv("TTS_ENGINE", "pyttsx3")  # TTS engine choice
        
        # API Keys (for future integrations)
        self.GOOGLE_CALENDAR_CREDENTIALS: Optional[str] = os.getenv("GOOGLE_CALENDAR_CREDENTIALS")
        self.SEARCH_API_KEY: Optional[str] = os.getenv("SEARCH_API_KEY")
        
        # Security
        self.SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
        
        # Feature Flags
        self.ENABLE_SPEECH: bool = os.getenv("ENABLE_SPEECH", "False").lower() == "true"
        self.ENABLE_CALENDAR: bool = os.getenv("ENABLE_CALENDAR", "False").lower() == "true"
        self.ENABLE_RAG: bool = os.getenv("ENABLE_RAG", "False").lower() == "true"
        self.ENABLE_WEB_SEARCH: bool = os.getenv("ENABLE_WEB_SEARCH", "False").lower() == "true"
        
        # Performance Settings
        self.MAX_CONVERSATION_HISTORY: int = int(os.getenv("MAX_CONVERSATION_HISTORY", "10"))
        self.RESPONSE_TIMEOUT: int = int(os.getenv("RESPONSE_TIMEOUT", "60"))
        self.MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
        
        # Logging
        self.LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
        self.LOG_FILE: Optional[str] = os.getenv("LOG_FILE")
        
        # Create necessary directories
        self._create_directories()
    
    def _create_directories(self):
        """Create necessary directories if they don't exist"""
        directories = [
            self.DOCUMENTS_DIR,
            self.MODELS_DIR,
            self.CONVERSATIONS_DIR,
            self.CHROMA_PERSIST_DIRECTORY,
            Path(self.DATABASE_URL.replace("sqlite:///", "")).parent
        ]
        
        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)
    
    def get_model_recommendations(self) -> dict:
        """Get model recommendations based on system specs"""
        return {
            "small": {
                "model": "llama3.2:1b",
                "ram_required": "4GB",
                "description": "Fastest, least memory usage"
            },
            "medium": {
                "model": "llama3.2:3b", 
                "ram_required": "8GB",
                "description": "Good balance of speed and capability"
            },
            "large": {
                "model": "llama3.2:7b",
                "ram_required": "16GB", 
                "description": "Best quality responses"
            }
        }
    
    def validate_ollama_model(self) -> bool:
        """Check if the configured Ollama model is valid"""
        valid_models = ["llama3.2:1b", "llama3.2:3b", "llama3.2:7b", "llama3.1", "mistral", "codellama"]
        return any(self.OLLAMA_MODEL.startswith(model) for model in valid_models)
    
    def __str__(self):
        """String representation of settings (excluding sensitive data)"""
        return f"""
JARVIS AI Assistant Settings:
- Host: {self.HOST}:{self.PORT}
- Debug Mode: {self.DEBUG}
- Ollama Model: {self.OLLAMA_MODEL}
- Ollama URL: {self.OLLAMA_BASE_URL}
- Features Enabled: Speech={self.ENABLE_SPEECH}, Calendar={self.ENABLE_CALENDAR}, RAG={self.ENABLE_RAG}, Search={self.ENABLE_WEB_SEARCH}
- Database: {self.DATABASE_URL}
- Documents Directory: {self.DOCUMENTS_DIR}
"""