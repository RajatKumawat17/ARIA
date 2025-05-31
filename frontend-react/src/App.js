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
        
        // Get current mode from backend
        try {
          const modeData = await apiService.getCurrentMode();
          setCurrentMode(modeData.mode || 'voice');
        } catch (err) {
          // If mode endpoint fails, default to voice if speech is enabled
          setCurrentMode(speechEnabled ? 'voice' : 'chat');
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
  }, [speechEnabled]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="glass-effect border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-aria-blue to-aria-purple rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">ARIA</h1>
              <p className="text-xs text-gray-300">AI Voice Assistant</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Backend Status Indicator */}
            <div className="flex items-center space-x-2">
              {backendStatus === 'connected' ? (
                <Wifi className="w-4 h-4 text-green-400" />
              ) : backendStatus === 'disconnected' ? (
                <WifiOff className="w-4 h-4 text-red-400" />
              ) : (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              )}
              <span className={`text-xs ${
                backendStatus === 'connected' ? 'text-green-400' : 
                backendStatus === 'disconnected' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {backendStatus === 'connected' ? 'Connected' : 
                 backendStatus === 'disconnected' ? 'Disconnected' : 'Checking...'}
              </span>
            </div>

            {/* Mode Switch Buttons */}
            <div className="flex items-center space-x-1 bg-white/10 rounded-full p-1">
              <button
                onClick={() => handleManualModeSwitch('voice')}
                disabled={!speechEnabled || backendStatus !== 'connected'}
                className={`mode-switch-button ${
                  currentMode === 'voice' ? 'active' : ''
                } ${!speechEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={!speechEnabled ? 'Speech features disabled' : 'Voice Mode'}
              >
                <Mic className="w-4 h-4 mr-1" />
                Voice
              </button>
              <button
                onClick={() => handleManualModeSwitch('chat')}
                disabled={backendStatus !== 'connected'}
                className={`mode-switch-button ${
                  currentMode === 'chat' ? 'active' : ''
                } ${backendStatus !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Chat Mode"
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                Chat
              </button>
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg glass-effect hover:bg-white/20 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass-effect border-b border-white/10 animate-fade-in">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <h3 className="font-semibold mb-3">System Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Backend:</span>
                  <span className={
                    backendStatus === 'connected' ? 'text-green-400' : 'text-red-400'
                  }>
                    {backendStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Speech Service:</span>
                  <span className={speechEnabled ? 'text-green-400' : 'text-red-400'}>
                    {speechEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Current Mode:</span>
                  <span className="text-aria-blue capitalize">{currentMode}</span>
                </div>
                <div className="flex justify-between">
                  <span>Audio Support:</span>
                  <span className={
                    navigator.mediaDevices ? 'text-green-400' : 'text-red-400'
                  }>
                    {navigator.mediaDevices ? 'Available' : 'Not Available'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-400">
                  <p>Voice Commands:</p>
                  <ul className="mt-1 space-y-1">
                    <li>• "Switch to chat" - Enable text mode</li>
                    <li>• "Switch to voice" - Enable voice mode</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4">
        {backendStatus === 'disconnected' ? (
          <div className="text-center py-16">
            <WifiOff className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Backend Disconnected</h2>
            <p className="text-gray-300 mb-4">
              Cannot connect to ARIA backend server. Please ensure:
            </p>
            <ul className="text-left text-gray-300 space-y-2 max-w-md mx-auto">
              <li>• Backend server is running (python main.py)</li>
              <li>• Ollama is running (ollama serve)</li>
              <li>• Server is accessible at http://127.0.0.1:8000</li>
            </ul>
          </div>
        ) : backendStatus === 'checking' ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-aria-blue border-t-transparent mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold mb-2">Connecting to ARIA</h2>
            <p className="text-gray-300">Checking backend connection...</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto h-full">
            {currentMode === 'voice' ? (
              <VoiceInterface 
                onModeSwitch={handleModeSwitch}
                isEnabled={speechEnabled && backendStatus === 'connected'}
              />
            ) : (
              <div className="h-full flex flex-col">
                <ChatInterface onModeSwitch={handleModeSwitch} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="glass-effect border-t border-white/10 p-4 text-center text-sm text-gray-400">
        <p>ARIA - AI Voice Assistant | Press and hold to speak in voice mode</p>
      </footer>
    </div>
  );
}

export default App;