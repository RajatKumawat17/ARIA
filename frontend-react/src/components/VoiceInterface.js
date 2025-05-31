import React, { useState, useEffect, useCallback } from 'react';
import { Mic, Square, Volume2, AlertCircle } from 'lucide-react';
import { useAudioRecording } from '../hooks/useAudioRecording';
import { apiService, audioUtils } from '../utils/api';
import WaveformVisualization from './WaveformVisualization';

const VoiceInterface = ({ onModeSwitch, isEnabled = true }) => {
  const [status, setStatus] = useState('idle'); // idle, recording, processing, playing
  const [lastResponse, setLastResponse] = useState('');
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    isRecording,
    audioLevel,
    error: recordingError,
    isSupported,
    startRecording,
    stopRecording,
    cleanup
  } = useAudioRecording();

  // Check speech service status on mount
  useEffect(() => {
    const checkSpeechStatus = async () => {
      try {
        const status = await apiService.getSpeechStatus();
        setIsInitialized(status.enabled && status.initialized);
        
        if (!status.enabled) {
          setError('Speech features are disabled on the server');
        }
      } catch (err) {
        setError('Cannot connect to speech service');
      }
    };

    checkSpeechStatus();
  }, []);

  // Handle recording button press and hold
  const handleMouseDown = useCallback(async () => {
    if (!isEnabled || !isInitialized || status === 'processing') return;

    setError(null);
    setStatus('recording');
    
    const success = await startRecording();
    if (!success) {
      setStatus('idle');
      setError('Failed to start recording');
    }
  }, [isEnabled, isInitialized, status, startRecording]);

  const handleMouseUp = useCallback(async () => {
    if (status !== 'recording') return;

    setStatus('processing');
    
    try {
      const audioBlob = await stopRecording();
      
      if (!audioBlob) {
        setStatus('idle');
        setError('No audio recorded');
        return;
      }

      // Process speech through backend
      const response = await apiService.processSpeech(audioBlob);
      
      // Update last response text
      if (response.responseText) {
        setLastResponse(response.responseText);
      }

      // Check for mode switch
      if (response.modeSwitch === 'chat') {
        onModeSwitch('chat');
        setStatus('idle');
        return;
      }

      // Play response audio
      if (response.audioBlob) {
        setStatus('playing');
        await audioUtils.playAudioBlob(response.audioBlob);
      }

      setStatus('idle');
    } catch (err) {
      console.error('Speech processing error:', err);
      setError(err.message || 'Failed to process speech');
      setStatus('idle');
    }
  }, [status, stopRecording, onModeSwitch]);

  // Handle touch events for mobile
  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    handleMouseDown();
  }, [handleMouseDown]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    handleMouseUp();
  }, [handleMouseUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Show error if not supported
  if (!isSupported) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Microphone Not Supported</h3>
        <p className="text-gray-300">
          Your browser doesn't support audio recording. Please use a modern browser.
        </p>
      </div>
    );
  }

  // Show loading if not initialized
  if (!isInitialized && !error) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-aria-blue border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-300">Initializing speech service...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-8 p-8">
      {/* Status Display */}
      <div className="text-center min-h-[60px]">
        {status === 'idle' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold mb-2">Ready to Listen</h2>
            <p className="text-gray-300">Press and hold the button to speak</p>
          </div>
        )}
        
        {status === 'recording' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-red-400 mb-2">Listening...</h2>
            <p className="text-gray-300">Release to send your message</p>
          </div>
        )}
        
        {status === 'processing' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-aria-blue mb-2">Processing...</h2>
            <p className="text-gray-300">Thinking about your request</p>
          </div>
        )}
        
        {status === 'playing' && (
          <div className="animate-fade-in flex items-center justify-center space-x-2">
            <Volume2 className="w-6 h-6 text-green-400" />
            <h2 className="text-2xl font-bold text-green-400">Speaking...</h2>
          </div>
        )}
      </div>

      {/* Waveform Visualization */}
      <WaveformVisualization 
        audioLevel={audioLevel}
        isActive={isRecording || status === 'playing'}
        className="mb-4"
      />

      {/* Main Voice Button */}
      <button
        className={`voice-button ${isRecording ? 'recording' : ''} ${
          !isEnabled || !isInitialized ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Stop recording if mouse leaves button
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        disabled={!isEnabled || !isInitialized || status === 'processing'}
      >
        {status === 'processing' ? (
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent" />
        ) : isRecording ? (
          <Square className="w-8 h-8 text-white" />
        ) : (
          <Mic className="w-8 h-8 text-white" />
        )}
      </button>

      {/* Instructions */}
      <div className="text-center text-sm text-gray-400 max-w-md">
        <p>
          {isRecording 
            ? "Keep holding to continue recording..."
            : "Press and hold to record your voice message"
          }
        </p>
        <p className="mt-2">
          Say "switch to chat" to use text mode
        </p>
      </div>

      {/* Last Response Display */}
      {lastResponse && (
        <div className="glass-effect rounded-lg p-4 max-w-md text-center animate-fade-in">
          <h4 className="font-semibold mb-2 text-aria-blue">Last Response:</h4>
          <p className="text-sm text-gray-200">{lastResponse}</p>
        </div>
      )}

      {/* Error Display */}
      {(error || recordingError) && (
        <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-4 max-w-md animate-fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-200 text-sm">
              {error || recordingError}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceInterface;