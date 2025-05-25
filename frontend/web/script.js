class JarvisChat {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        
        this.initializeElements();
        this.bindEvents();
        this.connect();
        
        // Auto-resize textarea
        this.setupAutoResize();
    }

    initializeElements() {
        // Main elements
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.aiIndicator = document.getElementById('aiIndicator');
        this.charCount = document.getElementById('charCount');
        
        // Modal elements
        this.settingsModal = document.getElementById('settingsModal');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.closeSettings = document.getElementById('closeSettings');
        this.checkHealth = document.getElementById('checkHealth');
        this.clearHistory = document.getElementById('clearHistory');
        this.ollamaStatus = document.getElementById('ollamaStatus');
        
        // Quick action buttons
        this.quickBtns = document.querySelectorAll('.quick-btn');
    }

    bindEvents() {
        // Send message events
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Character counter
        this.messageInput.addEventListener('input', () => {
            this.updateCharCount();
        });

        // Quick action buttons
        this.quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.dataset.text;
                this.messageInput.value = text;
                this.updateCharCount();
                this.sendMessage();
            });
        });

        // Settings modal
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.closeSettings.addEventListener('click', () => this.closeSettingsModal());
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettingsModal();
            }
        });

        // Settings actions
        this.checkHealth.addEventListener('click', () => this.checkSystemHealth());
        this.clearHistory.addEventListener('click', () => this.clearChatHistory());

        // Voice button (disabled for now)
        const voiceBtn = document.getElementById('voiceBtn');
        voiceBtn.addEventListener('click', () => {
            this.showToast('Voice features coming in Phase 2!', 'info');
        });
    }

    setupAutoResize() {
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        });
    }

    connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('Connected to JARVIS');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('online');
                this.animateAI(true);
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };

            this.ws.onclose = () => {
                console.log('Disconnected from JARVIS');
                this.isConnected = false;
                this.updateConnectionStatus('offline');
                this.animateAI(false);
                this.hideTyping();
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showToast('Connection error occurred', 'error');
            };

        } catch (error) {
            console.error('Failed to connect:', error);
            this.updateConnectionStatus('offline');
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.updateConnectionStatus('offline', `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            this.updateConnectionStatus('offline', 'Connection failed');
            this.showToast('Unable to connect to JARVIS. Please refresh the page.', 'error');
        }
    }

    updateConnectionStatus(status, customText = null) {
        this.connectionStatus.className = `status-indicator ${status}`;
        
        if (customText) {
            this.connectionStatus.textContent = customText;
        } else {
            this.connectionStatus.textContent = status === 'online' ? 'Connected' : 'Disconnected';
        }
    }

    animateAI(active) {
        if (active) {
            this.aiIndicator.style.animation = 'pulse 2s infinite';
            this.aiIndicator.style.background = '#00ff41';
        } else {
            this.aiIndicator.style.animation = 'none';
            this.aiIndicator.style.background = '#ff4141';
        }
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message || !this.isConnected) {
            if (!this.isConnected) {
                this.showToast('Not connected to JARVIS', 'error');
            }
            return;
        }

        // Add user message to chat
        this.addMessage('user', message);
        
        // Send to WebSocket
        this.ws.send(JSON.stringify({
            type: 'user_message',
            content: message,
            timestamp: new Date().toISOString()
        }));

        // Clear input and reset height
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        this.updateCharCount();
        
        // Disable send button temporarily
        this.sendBtn.disabled = true;
        setTimeout(() => {
            this.sendBtn.disabled = false;
        }, 1000);
    }

    handleMessage(data) {
        switch (data.type) {
            case 'assistant_message':
                this.hideTyping();
                this.addMessage('assistant', data.content, data.timestamp);
                break;
                
            case 'typing':
                this.showTyping(data.content);
                break;
                
            case 'system_response':
                this.addMessage('system', data.content, data.timestamp);
                break;
                
            case 'error':
                this.hideTyping();
                this.showToast(data.content, 'error');
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    addMessage(type, content, timestamp = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        const time = timestamp ? new Date(timestamp) : new Date();
        timeDiv.textContent = time.toLocaleString();
        
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTyping(message = 'JARVIS is thinking...') {
        this.typingIndicator.querySelector('.typing-text').textContent = message;
        this.typingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }

    hideTyping() {
        this.typingIndicator.style.display = 'none';
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }

    updateCharCount() {
        const length = this.messageInput.value.length;
        this.charCount.textContent = `${length}/1000`;
        
        if (length > 900) {
            this.charCount.style.color = '#ff4141';
        } else if (length > 700) {
            this.charCount.style.color = '#ff9900';
        } else {
            this.charCount.style.color = 'rgba(255, 255, 255, 0.5)';
        }
    }

    openSettings() {
        this.settingsModal.style.display = 'flex';
        this.checkSystemHealth();
    }

    closeSettingsModal() {
        this.settingsModal.style.display = 'none';
    }

    async checkSystemHealth() {
        this.ollamaStatus.textContent = 'Checking...';
        
        if (!this.isConnected) {
            this.ollamaStatus.textContent = 'Not connected';
            return;
        }

        try {
            this.ws.send(JSON.stringify({
                type: 'system_command',
                command: 'health'
            }));
        } catch (error) {
            this.ollamaStatus.textContent = 'Error checking health';
        }
    }

    clearChatHistory() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            this.chatMessages.innerHTML = '';
            
            if (this.isConnected) {
                this.ws.send(JSON.stringify({
                    type: 'system_command',
                    command: 'reset'
                }));
            }
            
            this.showToast('Chat history cleared', 'success');
            this.closeSettingsModal();
        }
    }

    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add styles
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            borderRadius: '10px',
            color: '#ffffff',
            fontWeight: '500',
            zIndex: '9999',
            animation: 'slideInRight 0.3s ease-out',
            maxWidth: '300px'
        });

        // Set background color based on type
        switch (type) {
            case 'success':
                toast.style.background = 'rgba(0, 255, 65, 0.9)';
                toast.style.color = '#000';
                break;
            case 'error':
                toast.style.background = 'rgba(255, 65, 65, 0.9)';
                break;
            case 'info':
            default:
                toast.style.background = 'rgba(0, 153, 255, 0.9)';
                break;
        }

        document.body.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Add toast animations to CSS dynamically
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(toastStyles);

// Initialize the chat application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.jarvisChat = new JarvisChat();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && window.jarvisChat && !window.jarvisChat.isConnected) {
        window.jarvisChat.connect();
    }
});