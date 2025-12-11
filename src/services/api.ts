/**
 * Maxi Agent API Service
 * All functions log per Guardian rules
 */

import logger from '../utils/logger';
import { getPow3rPassService } from './pow3rPass';

const COMPONENT = 'API';
const WORKER_URL = 'https://maxi-orchestrator.contact-7d8.workers.dev';

export interface ChatRequest {
  message: string;
  sessionId?: string;
  includeVoice?: boolean;
}

export interface ChatResponse {
  text: string;
  audioUrl?: string;
  sessionId: string;
  metadata?: {
    model: string;
    tokensUsed: number;
    retrievalCount: number;
  };
}

export interface AgentConfig {
  agentId: string;
  persona: {
    name: string;
    role: string;
    systemPrompt: string;
    greeting: string;
  };
  voice: {
    enabled: boolean;
    ttsProvider: string;
  };
  capabilities: {
    llm: {
      provider: string;
      model: string;
    };
  };
}

/**
 * Send a chat message to Maxi
 */
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  logger.info(COMPONENT, 'Sending chat message', { 
    messageLength: request.message.length,
    includeVoice: request.includeVoice 
  });

  try {
    const response = await fetch(`${WORKER_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-ID': 'maxi',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Chat API error: ${response.status}`);
    }

    const data = await response.json() as ChatResponse;
    logger.success(COMPONENT, 'Chat response received', { 
      textLength: data.text.length,
      hasAudio: !!data.audioUrl 
    });
    
    return data;
  } catch (error) {
    logger.error(COMPONENT, 'Chat request failed', error);
    throw error;
  }
}

/**
 * Get agent configuration from KV
 */
export async function getAgentConfig(): Promise<AgentConfig | null> {
  logger.info(COMPONENT, 'Fetching agent config');

  try {
    const response = await fetch(`${WORKER_URL}/config`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Agent-ID': 'maxi',
      },
    });

    if (!response.ok) {
      logger.warn(COMPONENT, `Config fetch failed: ${response.status}`);
      return null;
    }

    const config = await response.json() as AgentConfig;
    logger.success(COMPONENT, 'Config loaded', { agentId: config.agentId });
    return config;
  } catch (error) {
    logger.error(COMPONENT, 'Config fetch error', error);
    return null;
  }
}

/**
 * Save agent configuration to KV (for self-healing tests)
 */
export async function saveAgentConfig(config: AgentConfig): Promise<boolean> {
  logger.info(COMPONENT, 'Saving agent config', { agentId: config.agentId });

  try {
    const response = await fetch(`${WORKER_URL}/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-ID': 'maxi',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      logger.warn(COMPONENT, `Config save failed: ${response.status}`);
      return false;
    }

    logger.success(COMPONENT, 'Config saved successfully');
    return true;
  } catch (error) {
    logger.error(COMPONENT, 'Config save error', error);
    return false;
  }
}

/**
 * Get agent status
 */
export async function getAgentStatus(): Promise<{
  status: string;
  sessions: number;
  messages: number;
  uptime: string;
} | null> {
  logger.info(COMPONENT, 'Fetching agent status');

  try {
    const response = await fetch(`${WORKER_URL}/status`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      logger.warn(COMPONENT, `Status fetch failed: ${response.status}`);
      return null;
    }

    const status = await response.json();
    logger.success(COMPONENT, 'Status fetched', status);
    return status;
  } catch (error) {
    logger.error(COMPONENT, 'Status fetch error', error);
    return null;
  }
}

/**
 * Check API key availability via Pow3r Pass
 */
export async function checkApiKeys(): Promise<{
  xai: boolean;
  elevenlabs: boolean;
  gemini: boolean;
}> {
  logger.info(COMPONENT, 'Checking API key availability');

  const pow3rPass = getPow3rPassService();
  
  const [xai, elevenlabs, gemini] = await Promise.all([
    pow3rPass.hasCredential('xai'),
    pow3rPass.hasCredential('elevenlabs'),
    pow3rPass.hasCredential('gemini'),
  ]);

  const result = { xai, elevenlabs, gemini };
  logger.success(COMPONENT, 'API key check complete', result);
  return result;
}

/**
 * Health check for the worker
 */
export async function checkWorkerHealth(): Promise<boolean> {
  logger.info(COMPONENT, 'Checking worker health');

  try {
    const response = await fetch(`${WORKER_URL}/health`, {
      method: 'GET',
    });

    const healthy = response.ok;
    if (healthy) {
      logger.success(COMPONENT, 'Worker is healthy');
    } else {
      logger.warn(COMPONENT, 'Worker health check failed');
    }
    return healthy;
  } catch (error) {
    logger.error(COMPONENT, 'Worker health check error', error);
    return false;
  }
}
