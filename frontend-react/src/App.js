/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { MessageCircle, Mic, Settings, Wifi, WifiOff } from 'lucide-react';
import VoiceInterface from './components/VoiceInterface';
import ChatInterface from './components/ChatInterface';
import { apiService } from './utils/api';
import './App.css';

function App() {
  const [currentMode, setCurrentMode] = useState('voice'); // 'voice' or 'chat'
  const [backendStatus, setBackendStatus] = useState('checking'); // 'connected', 'disconnected', 'checking'
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Check backend connection on mount
  useEffect(() => {
  const checkBackend = async () => {
    try {
      const health = await apiService.checkHealth();
      setBackendStatus('connected');
      setSpeechEnabled(health.speech_service === true || health.speech_service === 'initialized');
      
      // Only get mode from backend on initial load, don't override user's manual selection
      if (currentMode === 'voice') { // Only check if we're currently in voice mode
        try {
          const modeData = await apiService.getCurrentMode();
          // Only switch to chat if speech is not enabled and we're currently in voice mode
          if (!speechEnabled && modeData.mode === 'voice') {
            setCurrentMode('chat');
          }
        } catch (err) {
          // If mode endpoint fails and speech isn't enabled, default to chat
          if (!speechEnabled) {
            setCurrentMode('chat');
          }
        }
      }
    } catch (err) {
      console.error('Backend connection failed:', err);
      setBackendStatus('disconnected');
      setSpeechEnabled(false);
      // Only fallback to chat if we're currently in voice mode
      if (currentMode === 'voice') {
        setCurrentMode('chat');
      }
    }
  };

  checkBackend();
  
  // Set up periodic health checks
  const interval = setInterval(() => {
    // Only check health, don't change mode automatically
    checkBackend();
  }, 30000);
  
  return () => clearInterval(interval);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  // Handle mode switching
  const handleModeSwitch = async (newMode) => {
    try {
      // Update backend mode
      await apiService.switchMode(newMode);
      setCurrentMode(newMode);
    } catch (err) {
      console.error('Failed to switch mode:', err);
      // Still update UI even if backend call fails
      setCurrentMode(newMode);
    }
  };

  // Handle manual mode switch from UI
  const handleManualModeSwitch = (mode) => {
    handleModeSwitch(mode);
  };

  return (
  <div className="App min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
    {/* Header */}
    <header className="glass-effect border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-aria-blue to-aria-purple rounded-lg flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">ARIA</h1>
            <p className="text-xs text-gray-400">AI Voice Assistant</p>
          </div>
        </div>

        {/* Manual Mode Switch Buttons */}
        <div className="flex items-center space-x-2">
          <div className="flex bg-white/10 rounded-lg p-1">
            <button
              onClick={() => handleManualModeSwitch('chat')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                currentMode === 'chat' 
                  ? 'bg-aria-blue text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <MessageCircle className="w-4 h-4 inline mr-1" />
              Chat
            </button>
            <button
              onClick={() => handleManualModeSwitch('voice')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                currentMode === 'voice' 
                  ? 'bg-aria-blue text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              } ${!speechEnabled ? 'opacity-50' : ''}`}
              disabled={!speechEnabled}
            >
              <Mic className="w-4 h-4 inline mr-1" />
              Voice
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {backendStatus === 'connected' ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <span className="text-xs text-gray-400">
              {backendStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg glass-effect hover:bg-white/20 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>

    {/* Settings Panel */}
    {showSettings && (
      <div className="glass-effect border-b border-white/10 animate-fade-in">
        {/* ... existing settings content ... */}
      </div>
    )}

    {/* Main Content */}
    <main className="main-content flex-1 p-4">
      {backendStatus === 'disconnected' ? (
        <div className="text-center py-16">
          {/* ... existing disconnected content ... */}
        </div>
      ) : backendStatus === 'checking' ? (
        <div className="text-center py-16">
          {/* ... existing checking content ... */}
        </div>
      ) : (
        <div className="max-w-6xl mx-auto h-full">
          {currentMode === 'voice' ? (
            <VoiceInterface 
              onModeSwitch={handleModeSwitch}
              isEnabled={speechEnabled && backendStatus === 'connected'}
            />
          ) : (
            <div className="chat-container h-full">
              <ChatInterface onModeSwitch={handleModeSwitch} />
            </div>
          )}
        </div>
      )}
    </main>

    {/* Footer */}
    <footer className="glass-effect border-t border-white/10 p-4 text-center text-sm text-gray-400 mt-auto">
      <p>ARIA - AI Voice Assistant | Press and hold to speak in voice mode</p>
    </footer>
  </div>
);
}

export default App;