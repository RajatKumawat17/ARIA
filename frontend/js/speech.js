class SpeechInterface {
  constructor() {
    this.isRecording = false;
    this.audioContext = null;
    this.mediaStream = null;
    this.analyzer = null;
    this.animationFrame = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.API_BASE = window.location.origin;
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.canvas = document.getElementById('waveform');
    this.ctx = this.canvas.getContext('2d');
    this.recordButton = document.getElementById('recordButton');
    this.modeSwitch = document.getElementById('modeSwitch');
    this.statusText = document.getElementById('speechStatus');
  }

  setupEventListeners() {
    this.recordButton.addEventListener('click', () => this.toggleRecording());
    this.modeSwitch.addEventListener('click', () => this.switchMode());
  }

  async initializeAudio() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyzer = this.audioContext.createAnalyser();
      this.analyzer.fftSize = 2048;
      source.connect(this.analyzer);

      // Initialize MediaRecorder for sending audio to backend
      this.mediaRecorder = new MediaRecorder(this.mediaStream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      this.mediaRecorder.onstop = () => this.sendAudioToBackend();
    } catch (error) {
      console.error('Error initializing audio:', error);
      this.statusText.textContent = 'Error accessing microphone';
    }
  }

  async toggleRecording() {
    if (!this.isRecording) {
      await this.startRecording();
    } else {
      await this.stopRecording();
    }
  }

  async startRecording() {
    if (!this.audioContext) {
      await this.initializeAudio();
    }
    
    this.isRecording = true;
    this.recordButton.textContent = '⏹️ Stop';
    this.statusText.textContent = 'Listening...';
    this.audioChunks = [];
    this.mediaRecorder.start();
    this.drawWaveform();
  }

  async stopRecording() {
    this.isRecording = false;
    this.recordButton.textContent = '🎤 Start';
    this.statusText.textContent = 'Processing...';
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    this.clearWaveform();
  }

  async sendAudioToBackend() {
    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch(`${this.API_BASE}/api/speech/process`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the response text from headers
      const responseText = response.headers.get('X-Response-Text');
      const modeSwitch = response.headers.get('X-Mode-Switch');

      // Play audio response
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      await audio.play();

      // Check for mode switch command
      if (modeSwitch === 'chat') {
        this.switchMode();
      }

      this.statusText.textContent = 'Tap to speak';

    } catch (error) {
      console.error('Error sending audio to backend:', error);
      this.statusText.textContent = 'Error processing audio';
    }
  }

  drawWaveform() {
    const bufferLength = this.analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    const draw = () => {
      this.animationFrame = requestAnimationFrame(draw);
      this.analyzer.getByteTimeDomainData(dataArray);
      
      this.ctx.fillStyle = '#f7f7f8';
      this.ctx.fillRect(0, 0, width, height);
      
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = '#10a37f';
      this.ctx.beginPath();
      
      const sliceWidth = width / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;
        
        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      this.ctx.lineTo(width, height / 2);
      this.ctx.stroke();
    };
    
    draw();
  }

  clearWaveform() {
    this.ctx.fillStyle = '#f7f7f8';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  switchMode() {
    // Stop recording if active
    if (this.isRecording) {
      this.stopRecording();
    }

    // Clean up audio resources
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }

    // Switch to chat mode
    document.getElementById('speechInterface').style.display = 'none';
    document.getElementById('chatInterface').style.display = 'flex';
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SpeechInterface();
});