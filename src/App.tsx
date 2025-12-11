import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from './components/Icon';
import SettingsModal from './components/SettingsModal';
import logger from './utils/logger';
import { sendChatMessage, ChatResponse } from './services/api';

/**
 * Maxi Agent - Main Application
 * 
 * Guardian Compliance:
 * - Heroicons only (no emojis)
 * - All functions log
 * - Settings accessible
 * - Pow3r Pass for API keys
 * - Config-based theming
 */

const COMPONENT = 'App';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

export default function App() {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with greeting
  useEffect(() => {
    logger.info(COMPONENT, 'App initialized');
    
    const greeting: Message = {
      id: 'greeting',
      role: 'assistant',
      content: "Hey there! I'm Maxi, your wellness coach. I'm here to help you navigate relationships, mental health, and personal growth. What's on your mind today?",
      timestamp: new Date(),
    };
    
    setMessages([greeting]);
    logger.success(COMPONENT, 'Greeting message set');
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load preferences from localStorage
  useEffect(() => {
    logger.info(COMPONENT, 'Loading preferences from localStorage');
    
    const savedVoice = localStorage.getItem('maxi-voice-enabled');
    const savedDarkMode = localStorage.getItem('maxi-dark-mode');
    
    if (savedVoice !== null) {
      setVoiceEnabled(savedVoice === 'true');
    }
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    }
    
    logger.success(COMPONENT, 'Preferences loaded');
  }, []);

  // Save preferences
  const savePreferences = useCallback(() => {
    logger.info(COMPONENT, 'Saving preferences');
    localStorage.setItem('maxi-voice-enabled', String(voiceEnabled));
    localStorage.setItem('maxi-dark-mode', String(darkMode));
  }, [voiceEnabled, darkMode]);

  useEffect(() => {
    savePreferences();
  }, [voiceEnabled, darkMode, savePreferences]);

  // Send message handler
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    logger.info(COMPONENT, 'Sending user message', { length: userMessage.content.length });
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response: ChatResponse = await sendChatMessage({
        message: userMessage.content,
        includeVoice: voiceEnabled,
      });

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.text,
        timestamp: new Date(),
        audioUrl: response.audioUrl,
      };

      setMessages(prev => [...prev, assistantMessage]);
      logger.success(COMPONENT, 'Received assistant response', { length: response.text.length });

      // Auto-play audio if available
      if (response.audioUrl && voiceEnabled) {
        logger.info(COMPONENT, 'Playing audio response');
        const audio = new Audio(response.audioUrl);
        audio.play().catch(error => {
          logger.error(COMPONENT, 'Audio playback failed', error);
        });
      }
    } catch (error) {
      logger.error(COMPONENT, 'Chat error', error);
      
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, voiceEnabled]);

  // Handle voice toggle
  const handleVoiceToggle = useCallback((enabled: boolean) => {
    logger.info(COMPONENT, `Voice toggled: ${enabled}`);
    setVoiceEnabled(enabled);
  }, []);

  // Handle dark mode toggle
  const handleDarkModeToggle = useCallback((enabled: boolean) => {
    logger.info(COMPONENT, `Dark mode toggled: ${enabled}`);
    setDarkMode(enabled);
  }, []);

  // Handle mic button
  const handleMicToggle = useCallback(() => {
    logger.info(COMPONENT, `Mic toggled: ${!isListening}`);
    setIsListening(!isListening);
    // Voice input would be implemented here with Web Speech API
  }, [isListening]);

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      <div className="bg-background text-foreground min-h-screen flex flex-col max-w-2xl mx-auto">
        {/* Header */}
        <header className="flex items-center gap-3 p-4 bg-card border-b border-border sticky top-0 z-10">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/40">
            <Icon name="heart" className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Maxi</h1>
            <p className="text-sm text-foreground/60">Wellness Coach</p>
          </div>
          <button
            onClick={() => handleVoiceToggle(!voiceEnabled)}
            className="p-2 rounded-lg hover:bg-foreground/10 transition-colors"
            title={voiceEnabled ? 'Voice enabled' : 'Voice disabled'}
          >
            <Icon 
              name={voiceEnabled ? 'volume-up' : 'volume-off'} 
              className="w-5 h-5 text-foreground/60" 
            />
          </button>
          <button
            onClick={() => {
              logger.info(COMPONENT, 'Opening settings');
              setShowSettings(true);
            }}
            className="p-2 rounded-lg hover:bg-foreground/10 transition-colors"
            title="Settings"
          >
            <Icon name="settings" className="w-5 h-5 text-foreground/60" />
          </button>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-4 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border border-border rounded-bl-sm'
                }`}
              >
                <p className="leading-relaxed">{message.content}</p>
                <p className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-primary-foreground/60' : 'text-foreground/40'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm p-4">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </main>

        {/* Input Area */}
        <footer className="p-4 bg-card border-t border-border sticky bottom-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleMicToggle}
              className={`p-3 rounded-full transition-colors ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-foreground/10 text-foreground/60 hover:bg-foreground/20'
              }`}
              title={isListening ? 'Listening...' : 'Voice input'}
            >
              <Icon name={isListening ? 'microphone' : 'microphone'} className="w-5 h-5" />
            </button>
            
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Talk to Maxi..."
              disabled={isLoading}
              className="flex-1 bg-background border border-border rounded-full px-4 py-3 text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary transition-colors"
            />
            
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="p-3 rounded-full bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              title="Send message"
            >
              <Icon name="send" className="w-5 h-5" />
            </button>
          </div>
        </footer>

        {/* Settings Modal */}
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          voiceEnabled={voiceEnabled}
          onVoiceToggle={handleVoiceToggle}
          darkMode={darkMode}
          onDarkModeToggle={handleDarkModeToggle}
        />
      </div>
    </div>
  );
}
