import aiohttp
import asyncio
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self, settings):
        self.settings = settings
        self.base_url = settings.OLLAMA_BASE_URL
        self.model_name = settings.OLLAMA_MODEL
        self.session = None
        self.conversation_history = []
        self.max_history = 10  # Keep last 10 exchanges for context

    async def _get_session(self):
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=60)
            )
        return self.session

    async def health_check(self) -> str:
        """Check if Ollama is running and model is available"""
        try:
            session = await self._get_session()

            # Check if Ollama is running
            async with session.get(f"{self.base_url}/api/tags") as response:
                if response.status != 200:
                    return "Ollama server not responding"

                models = await response.json()
                model_names = [model["name"] for model in models.get("models", [])]

                if self.model_name not in model_names:
                    return (
                        f"Model {self.model_name} not found. Available: {model_names}"
                    )

                return "healthy"

        except aiohttp.ClientError as e:
            logger.error(f"Ollama connection error: {str(e)}")
            return f"Connection error: {str(e)}"
        except Exception as e:
            logger.error(f"Health check error: {str(e)}")
            return f"Error: {str(e)}"

    async def generate_response(self, prompt: str, stream: bool = False) -> str:
        """Generate response using Ollama"""
        try:
            session = await self._get_session()

            # Build conversation context
            messages = self._build_conversation_context(prompt)

            payload = {
                "model": self.model_name,
                "messages": messages,
                "stream": stream,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "max_tokens": 512,
                    "stop": ["Human:", "User:"],
                },
            }

            logger.info(f"Sending request to Ollama: {self.model_name}")

            async with session.post(
                f"{self.base_url}/api/chat", json=payload
            ) as response:

                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Ollama API error {response.status}: {error_text}")
                    raise Exception(f"Ollama API error: {response.status}")

                if stream:
                    return await self._handle_streaming_response(response)
                else:
                    result = await response.json()
                    assistant_message = result.get("message", {}).get("content", "")

                    # Update conversation history
                    self._update_conversation_history(prompt, assistant_message)

                    return assistant_message.strip()

        except aiohttp.ClientError as e:
            logger.error(f"Network error with Ollama: {str(e)}")
            raise Exception(f"Network error: {str(e)}")
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            raise Exception("Invalid response from Ollama")
        except Exception as e:
            logger.error(f"LLM generation error: {str(e)}")
            raise

    async def _handle_streaming_response(self, response) -> str:
        """Handle streaming response from Ollama"""
        full_response = ""

        async for line in response.content:
            if line:
                try:
                    chunk = json.loads(line.decode("utf-8"))
                    if "message" in chunk and "content" in chunk["message"]:
                        content = chunk["message"]["content"]
                        full_response += content

                    if chunk.get("done", False):
                        break

                except json.JSONDecodeError:
                    continue

        return full_response.strip()

    def _build_conversation_context(self, current_prompt: str) -> list:
        """Build conversation context with history"""
        messages = [{"role": "system", "content": self._get_system_prompt()}]

        # Add conversation history
        for exchange in self.conversation_history[-self.max_history :]:
            messages.extend(
                [
                    {"role": "user", "content": exchange["user"]},
                    {"role": "assistant", "content": exchange["assistant"]},
                ]
            )

        # Add current prompt
        messages.append({"role": "user", "content": current_prompt})

        return messages

    def _get_system_prompt(self) -> str:
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

    def _update_conversation_history(self, user_input: str, assistant_response: str):
        """Update conversation history for context"""
        self.conversation_history.append(
            {
                "user": user_input,
                "assistant": assistant_response,
                "timestamp": datetime.now().isoformat(),
            }
        )

        # Trim history if it gets too long
        if len(self.conversation_history) > self.max_history:
            self.conversation_history = self.conversation_history[-self.max_history :]

    def clear_conversation_history(self):
        """Clear conversation history"""
        self.conversation_history = []
        logger.info("Conversation history cleared")

    async def close(self):
        """Close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
