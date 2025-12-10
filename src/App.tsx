import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

const API_BASE = '/api';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add greeting on mount
  useEffect(() => {
    setMessages([{
      id: 'greeting',
      role: 'assistant',
      content: "Hey there! I'm Maxi, your wellness coach. I'm here to help you navigate relationships, mental health, and personal growth. What's on your mind today?",
      timestamp: new Date(),
    }]);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          includeVoice: voiceEnabled,
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.text,
        timestamp: new Date(),
        audioUrl: data.audioUrl,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Auto-play audio if available
      if (data.audioUrl && voiceEnabled) {
        const audio = new Audio(data.audioUrl);
        audio.play().catch(console.error);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="avatar">
          <img src="/assets/maxi/thumbnail.png" alt="Maxi" />
        </div>
        <div className="title">
          <h1>Maxi</h1>
          <span className="subtitle">Wellness Coach</span>
        </div>
        <button 
          className={`voice-toggle ${voiceEnabled ? 'active' : ''}`}
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          title={voiceEnabled ? 'Voice enabled' : 'Voice disabled'}
        >
          {voiceEnabled ? '🔊' : '🔇'}
        </button>
      </header>

      {/* Messages */}
      <main className="messages">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`message ${message.role}`}
          >
            <div className="message-content">{message.content}</div>
            <div className="message-time">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant loading">
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <footer className="input-area">
        <button 
          className={`mic-button ${isListening ? 'listening' : ''}`}
          onClick={() => setIsListening(!isListening)}
          title="Hold to speak"
        >
          🎤
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Talk to Maxi..."
          disabled={isLoading}
        />
        <button 
          className="send-button"
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
        >
          ➤
        </button>
      </footer>

      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #0a1628;
          color: #fff;
        }

        .app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          max-width: 600px;
          margin: 0 auto;
        }

        .header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(180deg, #1a2a4a 0%, #0a1628 100%);
          border-bottom: 1px solid #2a3a5a;
        }

        .avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid #4a6a9a;
        }

        .avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .title h1 {
          font-size: 20px;
          font-weight: 600;
        }

        .subtitle {
          font-size: 12px;
          color: #8a9aba;
        }

        .voice-toggle {
          margin-left: auto;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          opacity: 0.8;
        }

        .voice-toggle:hover {
          opacity: 1;
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .message {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 16px;
        }

        .message.user {
          align-self: flex-end;
          background: #3a6aca;
          border-bottom-right-radius: 4px;
        }

        .message.assistant {
          align-self: flex-start;
          background: #1a2a4a;
          border-bottom-left-radius: 4px;
        }

        .message-content {
          line-height: 1.5;
        }

        .message-time {
          font-size: 10px;
          color: #8a9aba;
          margin-top: 4px;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: #4a6a9a;
          border-radius: 50%;
          animation: bounce 1.4s infinite;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }

        .input-area {
          display: flex;
          gap: 8px;
          padding: 16px;
          background: #1a2a4a;
          border-top: 1px solid #2a3a5a;
        }

        .input-area input {
          flex: 1;
          padding: 12px 16px;
          border-radius: 24px;
          border: 1px solid #3a4a6a;
          background: #0a1628;
          color: #fff;
          font-size: 16px;
        }

        .input-area input::placeholder {
          color: #6a7a9a;
        }

        .input-area input:focus {
          outline: none;
          border-color: #4a7aca;
        }

        .mic-button, .send-button {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          background: #3a6aca;
          color: #fff;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mic-button:hover, .send-button:hover {
          background: #4a7ada;
        }

        .mic-button.listening {
          background: #ca3a3a;
          animation: pulse 1s infinite;
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
