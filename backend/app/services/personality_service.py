import random
import re
from datetime import datetime
from typing import List, Dict

class PersonalityService:
    def __init__(self):
        self.welcome_messages = [
            "Good day! ARIA at your service. How may I assist you today?",
            "Hello there! Your personal AI assistant is ready and eager to help.",
            "Greetings! ARIA online and operational. What can I do for you?",
            "Welcome back! I trust you're having a productive day. How can I help?",
            "At your service! What pressing matters shall we tackle today?"
        ]
        
        self.error_messages = [
            "I apologize, but I seem to have encountered a slight technical difficulty. Shall we try that again?",
            "My circuits are feeling a bit scrambled at the moment. Could you repeat your request?",
            "I'm afraid something went awry on my end. Perhaps we could approach this differently?",
            "It appears I've hit a minor snag. Let me gather my wits and we'll try once more.",
            "Technical difficulties, I'm afraid. Even AI assistants have their off moments!"
        ]
        
        self.thinking_responses = [
            "Let me ponder that for a moment...",
            "Processing your request...",
            "Analyzing the situation...",
            "Consulting my vast knowledge base...",
            "One moment while I consider this..."
        ]

    def get_welcome_message(self) -> str:
        """Get a random welcome message"""
        return random.choice(self.welcome_messages)

    def get_error_message(self) -> str:
        """Get a random error message with personality"""
        return random.choice(self.error_messages)

    def get_thinking_message(self) -> str:
        """Get a random thinking/processing message"""
        return random.choice(self.thinking_responses)

    def get_system_prompt(self) -> str:
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

    def enhance_prompt(self, user_input: str) -> str:
        """Enhance user input with context and personality cues"""
        # Add time context if relevant
        current_time = datetime.now()
        time_context = self._get_time_context(current_time)
        
        # Check for specific types of requests that need special handling
        enhanced_prompt = user_input
        
        # Add time context for time-sensitive queries
        time_keywords = ['today', 'now', 'current', 'time', 'date', 'schedule', 'calendar']
        if any(keyword in user_input.lower() for keyword in time_keywords):
            enhanced_prompt = f"Current time context: {time_context}\n\nUser query: {user_input}"
        
        return enhanced_prompt

    def filter_response(self, ai_response: str) -> str:
        """Filter and enhance AI response with personality touches"""
        if not ai_response or ai_response.strip() == "":
            return self.get_error_message()
        
        # Clean up the response
        response = ai_response.strip()
        
        # Add personality flourishes occasionally
        response = self._add_personality_flourishes(response)
        
        # Ensure proper capitalization and punctuation
        response = self._clean_formatting(response)
        
        return response

    def _get_time_context(self, current_time: datetime) -> str:
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

    def _add_personality_flourishes(self, response: str) -> str:
        """Add occasional personality touches to responses"""
        # Don't modify every response, just occasionally
        if random.random() > 0.3:  # 30% chance of personality enhancement
            return response
            
        # List of personality flourishes
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
            ],
            'transition': [
                "Furthermore, ",
                "Additionally, ",
                "What's more, ",
                "I might add, ",
                "It's worth noting that "
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

    def _clean_formatting(self, text: str) -> str:
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
        
        # Fix common formatting issues
        text = re.sub(r'\s+([.!?])', r'\1', text)  # Remove space before punctuation
        text = re.sub(r'([.!?])\s*([a-z])', r'\1 \2', text)  # Ensure space after punctuation
        
        return text.strip()

    def get_capability_status(self) -> Dict[str, str]:
        """Return current capability status for user queries"""
        return {
            "speech_to_text": "Coming soon - Phase 2",
            "text_to_speech": "Coming soon - Phase 2", 
            "calendar_integration": "Coming soon - Phase 3",
            "document_analysis": "Coming soon - Phase 4",
            "web_search": "Coming soon - Phase 5",
            "basic_conversation": "Active",
            "personality": "Active"
        }

    def handle_capability_query(self, query: str) -> str:
        """Handle queries about current capabilities"""
        capabilities = self.get_capability_status()
        
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
            active_features = [k for k, v in capabilities.items() if v == "Active"]
            coming_features = [k for k, v in capabilities.items() if "Coming soon" in v]
            
            return f"Currently, I'm equipped with {', '.join(active_features)}. Coming soon: {', '.join(coming_features)}. I'm growing more capable by the day!"