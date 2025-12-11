import React, { useEffect, useState } from 'react';
import Icon from './Icon';
import logger from '../utils/logger';
import { getPow3rPassService, CredentialInfo } from '../services/pow3rPass';

/**
 * Settings Modal Component
 * Guardian compliance: Settings accessible in all apps
 */

const COMPONENT = 'SettingsModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  voiceEnabled: boolean;
  onVoiceToggle: (enabled: boolean) => void;
  darkMode: boolean;
  onDarkModeToggle: (enabled: boolean) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  voiceEnabled,
  onVoiceToggle,
  darkMode,
  onDarkModeToggle,
}) => {
  const [pow3rPassStatus, setPow3rPassStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [credentials, setCredentials] = useState<CredentialInfo[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const checkPow3rPass = async () => {
      logger.info(COMPONENT, 'Checking Pow3r Pass status');
      try {
        const pow3rPass = getPow3rPassService();
        const isHealthy = await pow3rPass.checkHealth();

        if (isHealthy) {
          setPow3rPassStatus('connected');
          const creds = await pow3rPass.getAllCredentials();
          setCredentials(creds);
          logger.success(COMPONENT, 'Pow3r Pass connected', { credentialCount: creds.length });
        } else {
          setPow3rPassStatus('disconnected');
          logger.warn(COMPONENT, 'Pow3r Pass disconnected');
        }
      } catch (error) {
        logger.error(COMPONENT, 'Pow3r Pass check failed', error);
        setPow3rPassStatus('disconnected');
      }
    };

    checkPow3rPass();
  }, [isOpen]);

  if (!isOpen) return null;

  logger.info(COMPONENT, 'Rendering settings modal');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="settings" className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          </div>
          <button
            onClick={() => {
              logger.info(COMPONENT, 'Closing settings');
              onClose();
            }}
            className="p-2 rounded-lg hover:bg-foreground/10 transition-colors"
          >
            <Icon name="cross" className="w-5 h-5 text-foreground/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Pow3r Pass Status */}
          <section>
            <h3 className="text-sm font-medium text-foreground/70 mb-3">Pow3r Pass (Credentials)</h3>
            <div className="bg-background rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  pow3rPassStatus === 'connected' ? 'bg-green-500' :
                  pow3rPassStatus === 'checking' ? 'bg-yellow-500 animate-pulse' :
                  'bg-red-500'
                }`} />
                <span className={`text-sm ${
                  pow3rPassStatus === 'connected' ? 'text-green-500' :
                  pow3rPassStatus === 'checking' ? 'text-yellow-500' :
                  'text-red-500'
                }`}>
                  {pow3rPassStatus === 'connected' ? 'Connected' :
                   pow3rPassStatus === 'checking' ? 'Checking...' :
                   'Disconnected'}
                </span>
              </div>

              {pow3rPassStatus === 'connected' && credentials.length > 0 && (
                <div className="mt-2 space-y-1">
                  {credentials.map((cred) => (
                    <div key={cred.provider} className="flex items-center justify-between text-xs">
                      <span className="text-foreground/60">{cred.provider}</span>
                      <span className={cred.available ? 'text-green-500' : 'text-yellow-500'}>
                        {cred.available ? 'Available' : 'Missing'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-foreground/40 mt-2">
                API keys managed via{' '}
                <a
                  href="https://config.superbots.link/pass"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Pow3r Pass
                </a>
              </p>
            </div>
          </section>

          {/* Voice Settings */}
          <section>
            <h3 className="text-sm font-medium text-foreground/70 mb-3">Voice</h3>
            <div className="bg-background rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name={voiceEnabled ? 'volume-up' : 'volume-off'} className="w-5 h-5 text-foreground/60" />
                  <span className="text-sm text-foreground">Voice Output</span>
                </div>
                <button
                  onClick={() => {
                    logger.info(COMPONENT, `Voice toggled: ${!voiceEnabled}`);
                    onVoiceToggle(!voiceEnabled);
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    voiceEnabled ? 'bg-primary' : 'bg-foreground/20'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    voiceEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="microphone" className="w-5 h-5 text-foreground/60" />
                  <span className="text-sm text-foreground">Voice Provider</span>
                </div>
                <span className="text-sm text-primary">ElevenLabs</span>
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section>
            <h3 className="text-sm font-medium text-foreground/70 mb-3">Appearance</h3>
            <div className="bg-background rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name={darkMode ? 'moon' : 'sun'} className="w-5 h-5 text-foreground/60" />
                  <span className="text-sm text-foreground">Dark Mode</span>
                </div>
                <button
                  onClick={() => {
                    logger.info(COMPONENT, `Dark mode toggled: ${!darkMode}`);
                    onDarkModeToggle(!darkMode);
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    darkMode ? 'bg-primary' : 'bg-foreground/20'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    darkMode ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </section>

          {/* About */}
          <section>
            <h3 className="text-sm font-medium text-foreground/70 mb-3">About</h3>
            <div className="bg-background rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/60">Agent</span>
                <span className="text-foreground">Maxi</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/60">Role</span>
                <span className="text-foreground">Wellness Coach</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/60">LLM</span>
                <span className="text-foreground">xAI/Grok-2</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/60">Version</span>
                <span className="text-foreground">1.0.0</span>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-foreground/40 text-center">
            Built with pow3r.abi
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
