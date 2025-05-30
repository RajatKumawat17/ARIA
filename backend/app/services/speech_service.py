import asyncio
import logging
import tempfile
import os
import io
from typing import Optional, AsyncGenerator
import whisper
import numpy as np
import wave
import struct
import subprocess
import json
from pathlib import Path

logger = logging.getLogger(__name__)

class SpeechService:
    def __init__(self, settings):
        self.settings = settings
        self.whisper_model = None
        self.kokoro_path = None  # Path to Kokoro TTS binary/script
        self.is_initialized = False
        
    async def initialize(self):
        """Initialize Whisper and Kokoro models"""
        if self.is_initialized:
            return
            
        try:
            # Initialize Whisper
            logger.info("Loading Whisper model...")
            model_size = self.settings.STT_MODEL or "base"
            self.whisper_model = whisper.load_model(model_size)
            logger.info(f"Whisper model '{model_size}' loaded successfully")
            
            # Check for Kokoro TTS
            await self._initialize_kokoro()
            
            self.is_initialized = True
            logger.info("Speech service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize speech service: {str(e)}")
            raise

    async def _initialize_kokoro(self):
        """Initialize Kokoro TTS system"""
        # Check if Kokoro is available in common locations
        possible_paths = [
            "./kokoro/kokoro_tts.py",  # Local installation
            "kokoro",  # System PATH
            "python -m kokoro",  # Python module
            "./models/kokoro/kokoro_tts.py"  # Models directory
        ]
        
        for path in possible_paths:
            if await self._test_kokoro_path(path):
                self.kokoro_path = path
                logger.info(f"Kokoro TTS found at: {path}")
                return
                
        logger.warning("Kokoro TTS not found. Please install Kokoro TTS or update the path.")
        # For now, we'll use a fallback TTS method
        self.kokoro_path = None

    async def _test_kokoro_path(self, path: str) -> bool:
        """Test if a Kokoro path is valid"""
        try:
            if path.endswith('.py') and os.path.exists(path):
                return True
            elif ' ' not in path:  # Simple command
                result = await asyncio.create_subprocess_exec(
                    path, '--help',
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await result.wait()
                return result.returncode == 0
            return False
        except:
            return False

    async def transcribe_audio(self, audio_data: bytes) -> str:
        """Transcribe audio using Whisper"""
        if not self.is_initialized:
            await self.initialize()
            
        try:
            # Save audio data to temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_path = temp_file.name
            
            try:
                # Transcribe using Whisper
                result = self.whisper_model.transcribe(temp_path)
                transcription = result["text"].strip()
                
                logger.info(f"Transcription: {transcription}")
                return transcription
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                    
        except Exception as e:
            logger.error(f"Transcription error: {str(e)}")
            raise

    async def synthesize_speech(self, text: str, voice: str = "default") -> bytes:
        """Synthesize speech using Kokoro TTS"""
        if not text.strip():
            return b""
            
        try:
            if self.kokoro_path:
                return await self._kokoro_synthesize(text, voice)
            else:
                # Fallback to system TTS (for development)
                return await self._fallback_tts(text)
                
        except Exception as e:
            logger.error(f"TTS error: {str(e)}")
            # Return empty audio on error
            return self._generate_silence(1.0)

    async def _kokoro_synthesize(self, text: str, voice: str) -> bytes:
        """Synthesize using Kokoro TTS"""
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as output_file:
                output_path = output_file.name
            
            # Prepare Kokoro command
            if self.kokoro_path.endswith('.py'):
                cmd = [
                    "python", self.kokoro_path,
                    "--text", text,
                    "--output", output_path,
                    "--voice", voice
                ]
            else:
                cmd = [
                    self.kokoro_path,
                    "--text", text,
                    "--output", output_path,
                    "--voice", voice
                ]
            
            # Run Kokoro TTS
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                logger.error(f"Kokoro TTS error: {stderr.decode()}")
                return self._generate_silence(1.0)
            
            # Read generated audio
            if os.path.exists(output_path):
                with open(output_path, "rb") as f:
                    audio_data = f.read()
                os.unlink(output_path)
                return audio_data
            else:
                logger.error("Kokoro TTS did not generate output file")
                return self._generate_silence(1.0)
                
        except Exception as e:
            logger.error(f"Kokoro synthesis error: {str(e)}")
            return self._generate_silence(1.0)

    async def _fallback_tts(self, text: str) -> bytes:
        """Fallback TTS using system tools (for development)"""
        try:
            # Try using espeak as fallback (common on Linux)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as output_file:
                output_path = output_file.name
            
            cmd = [
                "espeak",
                "-w", output_path,
                "-s", "150",  # Speed
                "-a", "100",  # Amplitude
                text
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            await process.communicate()
            
            if process.returncode == 0 and os.path.exists(output_path):
                with open(output_path, "rb") as f:
                    audio_data = f.read()
                os.unlink(output_path)
                return audio_data
            else:
                logger.warning("Fallback TTS (espeak) not available")
                return self._generate_silence(len(text) * 0.1)  # Rough estimate
            
        except Exception as e:
            logger.warning(f"Fallback TTS error: {str(e)}")
            return self._generate_silence(len(text) * 0.1)

    def _generate_silence(self, duration: float, sample_rate: int = 16000) -> bytes:
        """Generate silence audio data"""
        samples = int(duration * sample_rate)
        silence = np.zeros(samples, dtype=np.int16)
        
        # Create WAV file in memory
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(silence.tobytes())
        
        return buffer.getvalue()

    def detect_mode_switch(self, text: str) -> Optional[str]:
        """Detect if user wants to switch modes"""
        text_lower = text.lower().strip()
        
        # Switch to chat mode
        if any(phrase in text_lower for phrase in [
            "switch to chat", "go to chat", "chat mode", "text mode",
            "switch to text", "stop voice", "disable voice"
        ]):
            return "chat"
        
        # Switch to voice mode
        if any(phrase in text_lower for phrase in [
            "switch to voice", "voice mode", "speech mode", "talk mode",
            "enable voice", "start voice"
        ]):
            return "voice"
            
        return None

    async def process_speech_to_speech(self, audio_data: bytes, llm_service, personality_service) -> tuple[str, bytes]:
        """Complete speech-to-speech pipeline"""
        try:
            # Step 1: Transcribe speech to text
            transcription = await self.transcribe_audio(audio_data)
            
            if not transcription.strip():
                return "", self._generate_silence(0.5)
            
            # Step 2: Check for mode switching
            mode_switch = self.detect_mode_switch(transcription)
            if mode_switch:
                if mode_switch == "chat":
                    response_text = "Switching to chat mode. You can now type your messages."
                else:
                    response_text = "Voice mode is already active."
                
                response_audio = await self.synthesize_speech(response_text)
                return response_text, response_audio
            
            # Step 3: Generate text response using existing LLM service
            enhanced_prompt = personality_service.enhance_prompt(transcription)
            response_text = await llm_service.generate_response(enhanced_prompt)
            
            # Step 4: Apply personality filtering
            filtered_response = personality_service.filter_response(response_text)
            
            # Step 5: Synthesize speech
            response_audio = await self.synthesize_speech(filtered_response)
            
            return filtered_response, response_audio
            
        except Exception as e:
            logger.error(f"Speech-to-speech processing error: {str(e)}")
            error_msg = "I'm sorry, I encountered an error processing your request."
            error_audio = await self.synthesize_speech(error_msg)
            return error_msg, error_audio

    async def cleanup(self):
        """Cleanup resources"""
        # Whisper model cleanup is handled by garbage collector
        self.whisper_model = None
        self.is_initialized = False
        logger.info("Speech service cleaned up")