import { useState, useRef, useCallback } from 'react';

export const useAudioRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const chunksRef = useRef([]);

  // Monitor audio level for visual feedback
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateLevel = () => {
      // Check if still recording using ref or current state
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1
      
      setAudioLevel(normalizedLevel);
      
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  }, []); // Remove isRecording dependency

  // Initialize audio recording
  const initializeRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Whisper works well with 16kHz
        }
      });
      
      streamRef.current = stream;

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Handle recording data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Set up audio analysis for visual feedback
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      return true;
    } catch (err) {
      console.error('Error initializing recording:', err);
      setError(err.message);
      return false;
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) {
      const initialized = await initializeRecording();
      if (!initialized) return false;
    }

    try {
      chunksRef.current = [];
      mediaRecorderRef.current.start(100); // Collect data every 100ms
      setIsRecording(true);
      
      // Start audio level monitoring
      monitorAudioLevel();
      
      return true;
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err.message);
      return false;
    }
  }, [initializeRecording, monitorAudioLevel]);

  // Stop recording
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setIsRecording(false);
        setAudioLevel(0);
        
        // Stop audio level monitoring
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  }, [isRecording]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setIsRecording(false);
    setAudioLevel(0);
    setError(null);
  }, []);

  // Check if recording is supported
  const isSupported = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

  return {
    isRecording,
    audioLevel,
    error,
    isSupported,
    startRecording,
    stopRecording,
    cleanup,
  };
};