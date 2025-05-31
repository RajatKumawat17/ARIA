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
      
      // Get current mode from backend - don't override with speech-based logic
      try {
        const modeData = await apiService.getCurrentMode();
        setCurrentMode(modeData.mode || 'chat'); // Default to chat instead of voice
      } catch (err) {
        // If mode endpoint fails, keep current mode or default to chat
        if (currentMode === 'voice' && !speechEnabled) {
          setCurrentMode('chat');
        }
      }
    } catch (err) {
      console.error('Backend connection failed:', err);
      setBackendStatus('disconnected');
      setSpeechEnabled(false);
      setCurrentMode('chat'); // Fallback to chat mode
    }
  };

  checkBackend();
  
  // Set up periodic health checks
  const interval = setInterval(checkBackend, 30000); // Check every 30 seconds
  
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
      {/* ... existing header content ... */}
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