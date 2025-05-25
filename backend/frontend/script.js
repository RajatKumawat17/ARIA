/**
 * ARIA Chat Assistant - Enhanced JavaScript Module
 * Provides improved UI interactions and functionality
 */

class ARIAChat {
    constructor() {
        this.API_BASE = window.location.origin;
        this.messageHistory = [];
        this.isLoading = false;
        
        // Initialize the application
        this.init();
    }

    /**
     * Initialize the chat application
     */
    async init() {
        this.elements = this.initializeElements();
        this.setupEventListeners();
        this.initializeWelcomeMessage();
        await this.checkConnection();
        await this.loadAvailableModels();
        this.focusInput();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        return {
            // Core elements
            messages: document.getElementById('messages'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            modelSelect: document.getElementById('modelSelect'),
            loadingContainer: document.getElementById('loadingContainer'),
            
            // Status elements
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            statusSubtext: document.getElementById('statusSubtext'),
            
            // Control elements
            clearChat: document.getElementById('clearChat'),
            settingsBtn: document.getElementById('settingsBtn'),
            charCount: document.getElementById('charCount'),
            
            // Time elements
            welcomeTime: document.getElementById('welcomeTime')
        };
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Send button click
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // Input handling
        this.elements.messageInput.addEventListener('keydown', (e) => this.handleInputKeydown(e));
        this.elements.messageInput.addEventListener('input', () => this.handleInputChange());
        this.elements.messageInput.addEventListener('paste', () => {
            // Handle paste with slight delay to get the pasted content
            setTimeout(() => this.handleInputChange(), 10);
        });
        
        // Control buttons
        this.elements.clearChat.addEventListener('click', () => this.clearChatHistory());
        this.elements.settingsBtn.addEventListener('click', () => this.showSettings());
        
        // Model selection change
        this.elements.modelSelect.addEventListener('change', () => this.handleModelChange());
        
        // Window events
        window.addEventListener('online', () => this.handleConnectionChange(true));
        window.addEventListener('offline', () => this.handleConnectionChange(false));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));
    }

    /**
     * Initialize welcome message with current time
     */
    initializeWelcomeMessage() {
        if (this.elements.welcomeTime) {
            this.elements.welcomeTime.textContent = this.formatTime(new Date());
        }
    }

    /**
     * Handle input keydown events
     */
    handleInputKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        } else if (e.key === 'Escape') {
            this.elements.messageInput.blur();
        }
    }

    /**
     * Handle input changes (typing, pasting, etc.)
     */
    handleInputChange() {
        this.autoResize();
        this.updateCharCounter();
        this.updateSendButtonState();
    }

    /**
     * Handle global keyboard shortcuts
     */
    handleGlobalKeydown(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'k':
                    e.preventDefault();
                    this.focusInput();
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.sendMessage();
                    break;
                case 'r':
                    e.preventDefault();
                    this.clearChatHistory();
                    break;
            }
        }
    }

    /**
     * Auto-resize textarea based on content
     */
    autoResize() {
        const textarea = this.elements.messageInput;
        textarea.style.height = 'auto';
        const newHeight = Math.min(Math.max(textarea.scrollHeight, 24), 120);
        textarea.style.height = newHeight + 'px';
    }

    /**
     * Update character counter
     */
    updateCharCounter() {
        const length = this.elements.messageInput.value.length;
        this.elements.charCount.textContent = length;
        
        // Change color based on character count
        if (length > 1800) {
            this.elements.charCount.parentElement.style.color = '#ef4444';
        } else if (length > 1500) {
            this.elements.charCount.parentElement.style.color = '#f59e0b';
        } else {
            this.elements.charCount.parentElement.style.color = '#9ca3af';
        }
    }

    /**
     * Update send button state based on input
     */
    updateSendButtonState() {
        const hasText = this.elements.messageInput.value.trim().length > 0;
        this.elements.sendBtn.disabled = !hasText || this.isLoading;
    }

    /**
     * Focus on input field
     */
    focusInput() {
        this.elements.messageInput.focus();
    }

    /**
     * Check backend connection and status
     */
    async checkConnection() {
        try {
            const response = await fetch(`${this.API_BASE}/health`, {
                timeout: 5000
            });
            const data = await response.json();
            
            if (data.status === 'healthy') {
                this.updateConnectionStatus(true, 'Connected', `Ollama: ${data.ollama}`);
            } else {
                this.updateConnectionStatus(false, 'Backend connected', 'Ollama disconnected');
            }
        } catch (error) {
            this.updateConnectionStatus(false, 'Connection failed', 'Check server status');
            this.showError('Cannot connect to backend. Make sure the server is running on port 8000.');
            console.error('Connection error:', error);
        }
    }

    /**
     * Handle connection state changes
     */
    handleConnectionChange(isOnline) {
        if (isOnline) {
            this.checkConnection();
        } else {
            this.updateConnectionStatus(false, 'Offline', 'No internet connection');
        }
    }

    /**
     * Update connection status indicator
     */
    updateConnectionStatus(connected, message, subtext = '') {
        this.elements.statusIndicator.className = `status-indicator ${connected ? 'connected' : ''}`;
        this.elements.statusText.textContent = message;
        this.elements.statusSubtext.textContent = subtext;
    }

    /**
     * Load available models from backend
     */
    async loadAvailableModels() {
        try {
            const response = await fetch(`${this.API_BASE}/api/models`);
            const data = await response.json();
            
            if (data.models && data.models.length > 0) {
                this.populateModelSelect(data.models);
            }
        } catch (error) {
            console.log('Could not load models, using defaults:', error);
        }
    }

    /**
     * Populate model selection dropdown
     */
    populateModelSelect(models) {
        const currentValue = this.elements.modelSelect.value;
        this.elements.modelSelect.innerHTML = '';
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = this.formatModelName(model.name);
            this.elements.modelSelect.appendChild(option);
        });
        
        // Restore previous selection if it exists
        if (models.find(m => m.name === currentValue)) {
            this.elements.modelSelect.value = currentValue;
        }
    }

    /**
     * Format model name for display
     */
    formatModelName(modelName) {
        return modelName
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Handle model selection change
     */
    handleModelChange() {
        const selectedModel = this.elements.modelSelect.value;
        console.log('Model changed to:', selectedModel);
        // Could add model-specific settings or notifications here
    }

    /**
     * Send message to AI
     */
    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        if (!message || this.isLoading) return;

        const selectedModel = this.elements.modelSelect.value;
        
        try {
            // Add user message to chat
            this.addMessage(message, 'user');
            this.messageHistory.push({ role: 'user', content: message });
            
            // Clear input and update UI
            this.elements.messageInput.value = '';
            this.autoResize();
            this.updateCharCounter();
            this.setLoading(true);
            
            // Send request to backend
            const response = await fetch(`${this.API_BASE}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    model: selectedModel,
                    history: this.messageHistory.slice(-10) // Send last 10 messages for context
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Server error: ${response.status}`);
            }

            const data = await response.json();
            
            // Add AI response to chat
            this.addMessage(data.response, 'assistant');
            this.messageHistory.push({ role: 'assistant', content: data.response });
            
        } catch (error) {
            this.showError(`Error: ${error.message}`);
            console.error('Chat error:', error);
        } finally {
            this.setLoading(false);
            this.focusInput();
        }
    }

    /**
     * Set loading state
     */
    setLoading(isLoading) {
        this.isLoading = isLoading;
        
        if (isLoading) {
            this.elements.loadingContainer.classList.add('show');
        } else {
            this.elements.loadingContainer.classList.remove('show');
        }
        
        this.elements.sendBtn.disabled = isLoading;
        this.elements.messageInput.disabled = isLoading;
        this.updateSendButtonState();
    }

    /**
     * Add message to chat display
     */
    addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const avatar = this.createMessageAvatar(sender);
        const messageContent = this.createMessageContent(content, sender);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        // Insert before loading container if it exists
        const loadingContainer = this.elements.loadingContainer;
        if (loadingContainer && this.elements.messages.contains(loadingContainer)) {
            this.elements.messages.insertBefore(messageDiv, loadingContainer);
        } else {
            this.elements.messages.appendChild(messageDiv);
        }
        
        // Smooth scroll to bottom
        this.scrollToBottom();
    }

    /**
     * Create message avatar element
     */
    createMessageAvatar(sender) {
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        
        if (sender === 'user') {
            avatar.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
            `;
        } else {
            avatar.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            `;
        }
        
        return avatar;
    }

    /**
     * Create message content element
     */
    createMessageContent(content, sender) {
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content';
        
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const senderSpan = document.createElement('span');
        senderSpan.className = 'message-sender';
        senderSpan.textContent = sender === 'user' ? 'You' : 'ARIA';
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = this.formatTime(new Date());
        
        header.appendChild(senderSpan);
        header.appendChild(timeSpan);
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        
        if (sender === 'assistant') {
            // Parse markdown for assistant messages
            textDiv.innerHTML = this.parseMarkdown(content);
        } else {
            // Keep user messages as plain text but allow line breaks
            textDiv.innerHTML = this.escapeHtml(content).replace(/\n/g, '<br>');
        }
        
        contentWrapper.appendChild(header);
        contentWrapper.appendChild(textDiv);
        
        return contentWrapper;
    }

    /**
     * Format time for display
     */
    formatTime(date) {
        return date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    /**
     * Escape HTML characters
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Parse markdown to HTML
     */
    parseMarkdown(text) {
        let html = text
            // Headers
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            
            // Bold text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            
            // Italic text
            .replace(/\*((?!\*)(.*?))\*/g, '<em>$1</em>')
            .replace(/_((?!_)(.*?))_/g, '<em>$1</em>')
            
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        // Handle code blocks
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        // Handle unordered lists
        html = html.replace(/^\s*[-*+]\s+(.+)/gm, '<li>$1</li>');
        if (html.includes('<li>')) {
            html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        }
        
        // Handle ordered lists
        html = html.replace(/^\s*\d+\.\s+(.+)/gm, '<li>$1</li>');
        if (html.includes('<li>') && !html.includes('<ul>')) {
            html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
        }

        // Handle blockquotes
        html = html.replace(/^>\s+(.+)/gm, '<blockquote>$1</blockquote>');

        // Wrap in paragraphs if needed
        if (!html.includes('<p>') && !html.includes('<h') && 
            !html.includes('<ul>') && !html.includes('<ol>') && 
            !html.includes('<pre>') && !html.includes('<blockquote>')) {
            html = `<p>${html}</p>`;
        } else if (html.includes('</p><p>')) {
            html = `<p>${html}</p>`;
        }

        return html;
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.innerHTML = `<strong>Error:</strong> ${this.escapeHtml(message)}`;
        
        this.elements.messages.appendChild(errorDiv);
        this.scrollToBottom();
        
        // Auto-remove error after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 10000);
    }

    /**
     * Clear chat history
     */
    clearChatHistory() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            // Keep only the welcome message
            const welcomeMessage = this.elements.messages.querySelector('.welcome-message').parentElement;
            this.elements.messages.innerHTML = '';
            this.elements.messages.appendChild(welcomeMessage);
            
            // Clear message history
            this.messageHistory = [];
            
            // Focus input
            this.focusInput();
        }
    }

    /**
     * Show settings (placeholder for future implementation)
     */
    showSettings() {
        alert('Settings panel coming soon!');
    }

    /**
     * Smooth scroll to bottom of messages
     */
    scrollToBottom() {
        requestAnimationFrame(() => {
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        });
    }
}

// Initialize the chat application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're in the right environment
    if (typeof window !== 'undefined' && window.document) {
        new ARIAChat();
    }
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ARIAChat;
}