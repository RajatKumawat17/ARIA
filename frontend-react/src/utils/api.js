import axios from 'axios';

// Base URL for your backend
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// API endpoints
export const apiEndpoints = {
  // Speech endpoints
  processSpeech: '/api/speech/process',
  transcribeAudio: '/api/speech/transcribe',
  synthesizeSpeech: '/api/speech/synthesize',
  speechStatus: '/api/speech/status',
  
  // Chat endpoints
  chat: '/api/chat',
  clearHistory: '/api/clear-history',
  
  // Mode switching
  switchMode: '/api/mode/switch',
  getCurrentMode: '/api/mode/current',
  
  // System endpoints
  health: '/health',
  welcome: '/api/welcome',
  models: '/api/models',
  conversationStats: '/api/conversation-stats',
};

// Helper functions for API calls
export const apiService = {
  // Health check
  async checkHealth() {
    try {
      const response = await api.get(apiEndpoints.health);
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  },

  // Speech processing
  async processSpeech(audioBlob) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.wav');
      
      const response = await api.post(apiEndpoints.processSpeech, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        responseType: 'blob', // Expect audio response
      });
      
      return {
        audioBlob: response.data,
        responseText: response.headers['x-response-text'] || '',
        modeSwitch: response.headers['x-mode-switch'] || '',
      };
    } catch (error) {
      console.error('Speech processing failed:', error);
      throw error;
    }
  },

  // Text chat
  async sendChatMessage(message, model = 'llama3.2') {
    try {
      const response = await api.post(apiEndpoints.chat, {
        message,
        model,
      });
      return response.data;
    } catch (error) {
      console.error('Chat message failed:', error);
      throw error;
    }
  },

  // Mode switching
  async switchMode(mode) {
    try {
      const formData = new FormData();
      formData.append('mode', mode);
      
      const response = await api.post(apiEndpoints.switchMode, formData);
      return response.data;
    } catch (error) {
      console.error('Mode switch failed:', error);
      throw error;
    }
  },

  // Get current mode
  async getCurrentMode() {
    try {
      const response = await api.get(apiEndpoints.getCurrentMode);
      return response.data;
    } catch (error) {
      console.error('Get current mode failed:', error);
      throw error;
    }
  },

  // Get speech status
  async getSpeechStatus() {
    try {
      const response = await api.get(apiEndpoints.speechStatus);
      return response.data;
    } catch (error) {
      console.error('Get speech status failed:', error);
      throw error;
    }
  },

  // Get welcome message
  async getWelcomeMessage() {
    try {
      const response = await api.get(apiEndpoints.welcome);
      return response.data;
    } catch (error) {
      console.error('Get welcome message failed:', error);
      throw error;
    }
  },

  // Clear conversation history
  async clearHistory() {
    try {
      const response = await api.post(apiEndpoints.clearHistory);
      return response.data;
    } catch (error) {
      console.error('Clear history failed:', error);
      throw error;
    }
  },
};

// Audio utilities
export const audioUtils = {
  // Convert audio blob to format suitable for backend
  async blobToWav(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsArrayBuffer(blob);
    });
  },

  // Play audio blob
  playAudioBlob(blob) {
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = reject;
      audio.play().catch(reject);
    });
  },

  // Check if browser supports audio recording
  isRecordingSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  },
};

export default api;