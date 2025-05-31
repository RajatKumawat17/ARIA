import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, User, Bot, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';
import { apiService } from '../utils/api';

const ChatInterface = ({ onModeSwitch }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

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

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputMessage]);

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

    if (messages.length === 0) {
      loadWelcome();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Copy message to clipboard
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text:', err);
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
      <div className="flex-shrink-0 p-4 border-b border-white/10">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Chat with ARIA
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Your AI assistant is ready to help
            </p>
          </div>
          <button
            onClick={handleClearHistory}
            className="p-2 rounded-lg glass-effect hover:bg-white/20 transition-colors group"
            title="Clear chat history"
          >
            <Trash2 className="w-5 h-5 group-hover:text-red-400 transition-colors" />
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 space-y-6 min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`group ${message.type === 'user' ? 'ml-auto max-w-3xl' : 'mr-auto max-w-4xl'}`}
          >
            <div className={`flex gap-4 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                message.type === 'user' 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                  : message.type === 'error'
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : 'bg-gradient-to-r from-purple-500 to-purple-600'
              }`}>
                {message.type === 'user' ? (
                  <User className="w-5 h-5 text-white" />
                ) : (
                  <Bot className="w-5 h-5 text-white" />
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <div className={`rounded-2xl px-4 py-3 ${
                  message.type === 'user' 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white ml-auto' 
                    : message.type === 'error'
                    ? 'bg-red-500/20 border border-red-400/50 text-red-200'
                    : 'bg-white/5 border border-white/10 text-gray-100'
                }`}>
                  <div className="prose prose-invert max-w-none">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap m-0">
                      {message.content}
                    </p>
                  </div>
                  
                  {/* Message actions (only for assistant messages) */}
                  {message.type === 'assistant' && (
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10">
                      <span className="text-xs text-gray-400">
                        {formatTime(message.timestamp)}
                      </span>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyToClipboard(message.content)}
                          className="p-1 rounded hover:bg-white/10 transition-colors"
                          title="Copy message"
                        >
                          <Copy className="w-3 h-3 text-gray-400 hover:text-gray-300" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-white/10 transition-colors"
                          title="Good response"
                        >
                          <ThumbsUp className="w-3 h-3 text-gray-400 hover:text-green-400" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-white/10 transition-colors"
                          title="Poor response"
                        >
                          <ThumbsDown className="w-3 h-3 text-gray-400 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* User message timestamp */}
                  {message.type === 'user' && (
                    <div className="text-xs text-blue-200 mt-2 text-right">
                      {formatTime(message.timestamp)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="mr-auto max-w-4xl">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-gray-400">ARIA is thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex-shrink-0 mx-4 mb-4">
          <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-3 animate-fade-in">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="flex-shrink-0 p-4 border-t border-white/10">
        <form onSubmit={handleSendMessage} className="relative">
          <div className="glass-effect rounded-2xl border border-white/20 focus-within:border-blue-400/50 transition-colors">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message ARIA..."
              className="w-full bg-transparent px-4 py-3 pr-12 text-white placeholder-gray-400 focus:outline-none resize-none min-h-[52px] max-h-[200px]"
              disabled={isLoading}
              style={{ height: 'auto' }}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="absolute right-3 bottom-3 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all flex items-center justify-center group"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <Send className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
              )}
            </button>
          </div>
          
          {/* Input help text */}
          <p className="text-xs text-gray-500 mt-2 px-1">
            Press Enter to send • Shift+Enter for new line • Type "switch to voice" for voice mode
          </p>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;