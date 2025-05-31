import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, User, Bot } from 'lucide-react';
import { apiService } from '../utils/api';

const ChatInterface = ({ onModeSwitch }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load welcome message on mount
  useEffect(() => {
    const loadWelcome = async () => {
      try {
        const welcome = await apiService.getWelcomeMessage();
        setMessages([{
          id: Date.now(),
          type: 'assistant',
          content: welcome.message,
          timestamp: new Date().toISOString(),
        }]);
      } catch (err) {
        console.error('Failed to load welcome message:', err);
      }
    };

    loadWelcome();
  }, []);

  // Handle sending messages
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.sendChatMessage(userMessage.content);
      
      // Check for mode switch command
      if (userMessage.content.toLowerCase().includes('switch to voice') || 
          userMessage.content.toLowerCase().includes('voice mode')) {
        onModeSwitch('voice');
        return;
      }

      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setError('Failed to send message. Please try again.');
      
      // Add error message to chat
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle clearing chat history
  const handleClearHistory = async () => {
    try {
      await apiService.clearHistory();
      setMessages([]);
      setError(null);
      
      // Load fresh welcome message
      const welcome = await apiService.getWelcomeMessage();
      setMessages([{
        id: Date.now(),
        type: 'assistant',
        content: welcome.message,
        timestamp: new Date().toISOString(),
      }]);
    } catch (err) {
      console.error('Failed to clear history:', err);
      setError('Failed to clear history');
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="glass-effect p-4 mb-4 rounded-lg flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Chat with ARIA</h2>
          <p className="text-sm text-gray-300">Type your message or say "switch to voice"</p>
        </div>
        <button
          onClick={handleClearHistory}
          className="p-2 rounded-lg glass-effect hover:bg-white/20 transition-colors"
          title="Clear chat history"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4 px-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start space-x-2 max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl ${
              message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}>
              {/* Avatar */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.type === 'user' 
                  ? 'bg-aria-blue' 
                  : message.type === 'error'
                  ? 'bg-red-500'
                  : 'bg-aria-purple'
              }`}>
                {message.type === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              {/* Message Bubble */}
              <div className={`${
                message.type === 'user' 
                  ? 'chat-bubble-user' 
                  : message.type === 'error'
                  ? 'bg-red-500/20 border border-red-400/50 rounded-2xl rounded-bl-md p-4 max-w-xs mr-auto'
                  : 'chat-bubble-assistant'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
                <p className="text-xs opacity-60 mt-2">
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-2">
              <div className="w-8 h-8 rounded-full bg-aria-purple flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="chat-bubble-assistant">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-3 mb-4 animate-fade-in">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="glass-effect rounded-lg p-4">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-aria-blue focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="bg-aria-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-2 transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {/* Input help text */}
        <p className="text-xs text-gray-400 mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </form>
    </div>
  );
};

export default ChatInterface;