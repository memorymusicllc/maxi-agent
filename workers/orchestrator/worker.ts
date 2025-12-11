/**
 * Maxi Agent Orchestrator Worker
 * 
 * Guardian Compliance:
 * - All functions log
 * - Config persistence for self-healing tests
 * - Pow3r Pass for API key resolution
 * - No mock data
 */

export interface Env {
  // KV Namespace
  AGENT_STORE: KVNamespace;
  // Vectorize
  VECTORS: Vectorize;
  // R2 Bucket
  ASSETS: R2Bucket;
  // AI Binding
  AI: Ai;
  // Secrets (from Pow3r Pass or wrangler secret)
  XAI_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  GEMINI_API_KEY?: string;
  // Config
  AGENT_ID: string;
  AGENT_NAME: string;
  LLM_PROVIDER: string;
  LLM_MODEL: string;
  TTS_PROVIDER: string;
  ENVIRONMENT: string;
}

interface ChatRequest {
  message: string;
  sessionId?: string;
  includeVoice?: boolean;
  stream?: boolean;
}

interface ChatResponse {
  text: string;
  audioUrl?: string;
  sessionId: string;
  metadata?: {
    model: string;
    tokensUsed: number;
    retrievalCount: number;
  };
}

interface AgentConfig {
  agentId: string;
  version: string;
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
  lastUpdated: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-ID',
};

// Logger utility
function log(level: 'info' | 'warn' | 'error' | 'debug', component: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const logData = data ? JSON.stringify(data) : '';
  console.log(`[${timestamp}] [${level.toUpperCase()}] [${component}] ${message} ${logData}`);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    log('info', 'Worker', 'Request received', { url: request.url, method: request.method });

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === '/health' || path === '/') {
        log('info', 'Worker', 'Health check');
        return jsonResponse({
          status: 'healthy',
          agent: env.AGENT_NAME || 'Maxi',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        });
      }

      // Chat endpoint
      if (path === '/chat' && request.method === 'POST') {
        const body = await request.json() as ChatRequest;
        log('info', 'Worker', 'Chat request', { messageLength: body.message?.length });
        const response = await handleChat(body, env, ctx);
        return jsonResponse(response);
      }

      // Voice endpoint
      if (path === '/voice' && request.method === 'POST') {
        const { text, voiceId } = await request.json() as { text: string; voiceId?: string };
        log('info', 'Worker', 'Voice synthesis request', { textLength: text?.length });
        const audioBuffer = await synthesizeVoice(text, env, voiceId);
        return new Response(audioBuffer, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg',
          },
        });
      }

      // Search endpoint
      if (path === '/search' && request.method === 'POST') {
        const { query, limit } = await request.json() as { query: string; limit?: number };
        log('info', 'Worker', 'Knowledge search', { query });
        const results = await searchKnowledge(query, env, limit || 5);
        return jsonResponse({ results });
      }

      // Config endpoint - GET
      if (path === '/config' && request.method === 'GET') {
        log('info', 'Worker', 'Fetching config');
        const config = await env.AGENT_STORE.get('agent-config', 'json');
        if (!config) {
          // Return default config
          const defaultConfig = getDefaultConfig(env);
          await env.AGENT_STORE.put('agent-config', JSON.stringify(defaultConfig));
          log('info', 'Worker', 'Created default config');
          return jsonResponse(defaultConfig);
        }
        return jsonResponse(config);
      }

      // Config endpoint - PUT (for self-healing tests)
      if (path === '/config' && request.method === 'PUT') {
        const config = await request.json() as AgentConfig;
        log('info', 'Worker', 'Saving config', { agentId: config.agentId });
        config.lastUpdated = new Date().toISOString();
        await env.AGENT_STORE.put('agent-config', JSON.stringify(config));
        log('info', 'Worker', 'Config saved successfully');
        return jsonResponse({ success: true, config });
      }

      // Status endpoint
      if (path === '/status') {
        log('info', 'Worker', 'Status request');
        const stats = await getAgentStats(env);
        return jsonResponse(stats);
      }

      // MCP endpoint
      if (path === '/mcp' && request.method === 'POST') {
        const mcpRequest = await request.json();
        log('info', 'Worker', 'MCP request', { method: mcpRequest.method });
        const mcpResponse = await handleMCP(mcpRequest, env, ctx);
        return jsonResponse(mcpResponse);
      }

      // Pow3r Pass proxy (for credential resolution)
      if (path.startsWith('/pow3r-pass/')) {
        const provider = path.replace('/pow3r-pass/', '');
        log('info', 'Worker', 'Pow3r Pass credential request', { provider });
        const credential = await fetchPow3rPassCredential(provider);
        if (credential) {
          return jsonResponse({ token: credential });
        }
        return jsonResponse({ error: 'Credential not found' }, 404);
      }

      // Not found
      log('warn', 'Worker', 'Route not found', { path });
      return jsonResponse({ error: 'Not found' }, 404);

    } catch (error) {
      log('error', 'Worker', 'Request error', { error: error instanceof Error ? error.message : 'Unknown error' });
      return jsonResponse({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  },
};

// Get default config
function getDefaultConfig(env: Env): AgentConfig {
  return {
    agentId: 'maxi',
    version: '1.0.0',
    persona: {
      name: env.AGENT_NAME || 'Maxi',
      role: 'Wellness Coach',
      systemPrompt: 'You are Maxi, a compassionate wellness coach specializing in mental health, psychology, relationships, dating, self-improvement, power dynamics, decision making, and behavior change. You combine warmth with directness - you are supportive but also honest.',
      greeting: "Hey there! I'm Maxi, your wellness coach. I'm here to help you navigate relationships, mental health, and personal growth. What's on your mind today?",
    },
    voice: {
      enabled: true,
      ttsProvider: 'elevenlabs',
    },
    capabilities: {
      llm: {
        provider: env.LLM_PROVIDER || 'xai',
        model: env.LLM_MODEL || 'grok-2',
      },
    },
    lastUpdated: new Date().toISOString(),
  };
}

// Chat handler
async function handleChat(request: ChatRequest, env: Env, ctx: ExecutionContext): Promise<ChatResponse> {
  const sessionId = request.sessionId || crypto.randomUUID();
  log('info', 'Chat', 'Processing chat', { sessionId, includeVoice: request.includeVoice });
  
  // Retrieve relevant knowledge
  const knowledge = await searchKnowledge(request.message, env, 5);
  log('info', 'Chat', 'Knowledge retrieved', { count: knowledge.length });
  
  // Build context
  const context = knowledge.map(k => k.text).join('\n\n');
  
  // Load agent config
  const configRaw = await env.AGENT_STORE.get('agent-config');
  const config = configRaw ? JSON.parse(configRaw) : getDefaultConfig(env);
  const systemPrompt = config.persona?.systemPrompt || `You are ${env.AGENT_NAME}, a wellness coach.`;
  
  // Get API key (from env or Pow3r Pass)
  const apiKey = env.XAI_API_KEY || await fetchPow3rPassCredential('xai');
  if (!apiKey) {
    log('error', 'Chat', 'No API key available');
    throw new Error('No API key configured. Please add XAI_API_KEY via Pow3r Pass.');
  }
  
  // Call xAI/Grok
  log('info', 'Chat', 'Calling LLM', { provider: env.LLM_PROVIDER, model: env.LLM_MODEL });
  const response = await callLLM({
    provider: env.LLM_PROVIDER || 'xai',
    model: env.LLM_MODEL || 'grok-2',
    apiKey,
    messages: [
      { role: 'system', content: systemPrompt },
      ...(context ? [{ role: 'system', content: `Relevant knowledge:\n${context}` }] : []),
      { role: 'user', content: request.message },
    ],
  });
  log('info', 'Chat', 'LLM response received', { textLength: response.text.length });
  
  // Update stats
  await incrementStat(env, 'messages');
  
  // Optionally generate voice
  let audioUrl: string | undefined;
  if (request.includeVoice && config.voice?.enabled) {
    try {
      log('info', 'Chat', 'Generating voice');
      const audioBuffer = await synthesizeVoice(response.text, env);
      // Store in R2 temporarily
      const audioKey = `audio/${sessionId}/${Date.now()}.mp3`;
      await env.ASSETS.put(audioKey, audioBuffer);
      audioUrl = `/assets/${audioKey}`;
      log('info', 'Chat', 'Voice generated', { audioKey });
    } catch (error) {
      log('warn', 'Chat', 'Voice generation failed', { error });
    }
  }
  
  return {
    text: response.text,
    audioUrl,
    sessionId,
    metadata: {
      model: env.LLM_MODEL || 'grok-2',
      tokensUsed: response.tokensUsed || 0,
      retrievalCount: knowledge.length,
    },
  };
}

// LLM call
async function callLLM(options: {
  provider: string;
  model: string;
  apiKey: string;
  messages: Array<{ role: string; content: string }>;
}): Promise<{ text: string; tokensUsed?: number }> {
  const { provider, model, apiKey, messages } = options;
  
  // xAI/Grok endpoint
  const endpoint = provider === 'xai' 
    ? 'https://api.x.ai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  
  log('info', 'LLM', 'Calling API', { endpoint, model });
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    log('error', 'LLM', 'API error', { status: response.status, error: errorText });
    throw new Error(`LLM API error: ${response.status}`);
  }
  
  const data = await response.json() as any;
  log('info', 'LLM', 'Response received', { tokensUsed: data.usage?.total_tokens });
  
  return {
    text: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens,
  };
}

// Voice synthesis
async function synthesizeVoice(text: string, env: Env, voiceId?: string): Promise<ArrayBuffer> {
  const voice = voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Default voice
  
  // Get API key
  const apiKey = env.ELEVENLABS_API_KEY || await fetchPow3rPassCredential('elevenlabs');
  if (!apiKey) {
    log('error', 'Voice', 'No ElevenLabs API key');
    throw new Error('No ElevenLabs API key configured');
  }
  
  log('info', 'Voice', 'Synthesizing', { textLength: text.length, voice });
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });
  
  if (!response.ok) {
    log('error', 'Voice', 'ElevenLabs error', { status: response.status });
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }
  
  log('info', 'Voice', 'Synthesis complete');
  return response.arrayBuffer();
}

// Knowledge search
async function searchKnowledge(query: string, env: Env, limit: number = 5): Promise<Array<{ id: string; text: string; score: number }>> {
  log('info', 'Knowledge', 'Searching', { query, limit });
  
  try {
    // Generate embedding using CF AI
    const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: query });
    
    // Search vectorize
    const results = await env.VECTORS.query(embedding.data[0], { topK: limit });
    log('info', 'Knowledge', 'Vectorize results', { count: results.matches?.length || 0 });
    
    // Fetch full texts from KV
    const knowledge = await Promise.all(
      (results.matches || []).map(async (match: any) => {
        const text = await env.AGENT_STORE.get(`knowledge:${match.id}`);
        return {
          id: match.id,
          text: text || '',
          score: match.score,
        };
      })
    );
    
    return knowledge.filter(k => k.text);
  } catch (error) {
    log('warn', 'Knowledge', 'Search failed, returning empty', { error });
    return [];
  }
}

// Pow3r Pass credential fetch
async function fetchPow3rPassCredential(provider: string): Promise<string | null> {
  log('info', 'Pow3rPass', 'Fetching credential', { provider });
  
  try {
    const response = await fetch(`https://config.superbots.link/pass/credentials/${provider}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Agent-ID': 'maxi',
      },
    });
    
    if (!response.ok) {
      log('warn', 'Pow3rPass', 'Credential not found', { provider, status: response.status });
      return null;
    }
    
    const data = await response.json() as { token: string };
    log('info', 'Pow3rPass', 'Credential fetched', { provider });
    return data.token;
  } catch (error) {
    log('warn', 'Pow3rPass', 'Fetch failed', { provider, error });
    return null;
  }
}

// MCP handler
async function handleMCP(request: any, env: Env, ctx: ExecutionContext): Promise<any> {
  const { method, params } = request;
  log('info', 'MCP', 'Handling request', { method });
  
  switch (method) {
    case 'tools/list':
      return {
        tools: [
          { name: 'agent_chat', description: 'Send a message to Maxi' },
          { name: 'agent_voice', description: 'Generate voice response' },
          { name: 'agent_search', description: 'Search knowledge base' },
          { name: 'agent_config', description: 'Get or update agent config' },
          { name: 'agent_status', description: 'Get agent status' },
        ],
      };
    
    case 'tools/call':
      const { name, arguments: args } = params;
      log('info', 'MCP', 'Tool call', { name });
      
      switch (name) {
        case 'agent_chat':
          return handleChat(args, env, ctx);
        case 'agent_voice':
          const audio = await synthesizeVoice(args.text, env);
          return { success: true, audioLength: audio.byteLength };
        case 'agent_search':
          return { results: await searchKnowledge(args.query, env) };
        case 'agent_config':
          const config = await env.AGENT_STORE.get('agent-config', 'json');
          return config || getDefaultConfig(env);
        case 'agent_status':
          return getAgentStats(env);
        default:
          return { error: `Unknown tool: ${name}` };
      }
    
    default:
      return { error: `Unknown method: ${method}` };
  }
}

// Agent stats
async function getAgentStats(env: Env): Promise<any> {
  log('info', 'Stats', 'Fetching');
  
  const sessionsRaw = await env.AGENT_STORE.get('stats:sessions');
  const messagesRaw = await env.AGENT_STORE.get('stats:messages');
  
  return {
    agent: env.AGENT_NAME || 'Maxi',
    status: 'active',
    sessions: sessionsRaw ? parseInt(sessionsRaw) : 0,
    messages: messagesRaw ? parseInt(messagesRaw) : 0,
    uptime: '24/7',
    model: `${env.LLM_PROVIDER || 'xai'}/${env.LLM_MODEL || 'grok-2'}`,
    tts: env.TTS_PROVIDER || 'elevenlabs',
  };
}

// Increment stat counter
async function incrementStat(env: Env, stat: string): Promise<void> {
  const key = `stats:${stat}`;
  const current = await env.AGENT_STORE.get(key);
  const value = (current ? parseInt(current) : 0) + 1;
  await env.AGENT_STORE.put(key, String(value));
  log('debug', 'Stats', 'Incremented', { stat, value });
}

// JSON response helper
function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
