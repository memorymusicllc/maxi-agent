/**
 * Maxi Agent Orchestrator Worker
 * 
 * Main Cloudflare Worker that handles:
 * - Chat requests (via xAI/Grok-2)
 * - Voice synthesis (via ElevenLabs)
 * - Knowledge retrieval (via Vectorize)
 * - MCP tool execution
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
  // Secrets
  XAI_API_KEY: string;
  ELEVENLABS_API_KEY: string;
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

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === '/health' || path === '/') {
        return jsonResponse({
          status: 'healthy',
          agent: env.AGENT_NAME,
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        });
      }

      // Chat endpoint
      if (path === '/chat' && request.method === 'POST') {
        const body = await request.json() as ChatRequest;
        const response = await handleChat(body, env, ctx);
        return jsonResponse(response);
      }

      // Voice endpoint
      if (path === '/voice' && request.method === 'POST') {
        const { text, voiceId } = await request.json() as { text: string; voiceId?: string };
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
        const results = await searchKnowledge(query, env, limit || 5);
        return jsonResponse({ results });
      }

      // Config endpoint
      if (path === '/config') {
        const config = await env.AGENT_STORE.get('agent-config', 'json');
        return jsonResponse(config || { error: 'Config not found' });
      }

      // Status endpoint
      if (path === '/status') {
        const stats = await getAgentStats(env);
        return jsonResponse(stats);
      }

      // MCP endpoint
      if (path === '/mcp' && request.method === 'POST') {
        const mcpRequest = await request.json();
        const mcpResponse = await handleMCP(mcpRequest, env, ctx);
        return jsonResponse(mcpResponse);
      }

      // Not found
      return jsonResponse({ error: 'Not found' }, 404);

    } catch (error) {
      console.error('[Maxi Worker] Error:', error);
      return jsonResponse({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  },
};

// Chat handler
async function handleChat(request: ChatRequest, env: Env, ctx: ExecutionContext): Promise<ChatResponse> {
  const sessionId = request.sessionId || crypto.randomUUID();
  
  // Retrieve relevant knowledge
  const knowledge = await searchKnowledge(request.message, env, 5);
  
  // Build context
  const context = knowledge.map(k => k.text).join('\n\n');
  
  // Load agent config
  const configRaw = await env.AGENT_STORE.get('agent-config');
  const config = configRaw ? JSON.parse(configRaw) : null;
  const systemPrompt = config?.persona?.systemPrompt || `You are ${env.AGENT_NAME}, a wellness coach.`;
  
  // Call xAI/Grok
  const response = await callLLM({
    provider: env.LLM_PROVIDER,
    model: env.LLM_MODEL,
    apiKey: env.XAI_API_KEY,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: `Relevant knowledge:\n${context}` },
      { role: 'user', content: request.message },
    ],
  });
  
  // Optionally generate voice
  let audioUrl: string | undefined;
  if (request.includeVoice) {
    const audioBuffer = await synthesizeVoice(response.text, env);
    // Store in R2 temporarily
    const audioKey = `audio/${sessionId}/${Date.now()}.mp3`;
    await env.ASSETS.put(audioKey, audioBuffer);
    audioUrl = `/assets/${audioKey}`;
  }
  
  return {
    text: response.text,
    audioUrl,
    sessionId,
    metadata: {
      model: env.LLM_MODEL,
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
    throw new Error(`LLM API error: ${response.status}`);
  }
  
  const data = await response.json() as any;
  return {
    text: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens,
  };
}

// Voice synthesis
async function synthesizeVoice(text: string, env: Env, voiceId?: string): Promise<ArrayBuffer> {
  const voice = voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Default voice
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': env.ELEVENLABS_API_KEY,
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
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }
  
  return response.arrayBuffer();
}

// Knowledge search
async function searchKnowledge(query: string, env: Env, limit: number = 5): Promise<Array<{ id: string; text: string; score: number }>> {
  try {
    // Generate embedding
    const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: query });
    
    // Search vectorize
    const results = await env.VECTORS.query(embedding.data[0], { topK: limit });
    
    // Fetch full texts from KV
    const knowledge = await Promise.all(
      results.matches.map(async (match: any) => {
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
    console.error('[Knowledge Search] Error:', error);
    return [];
  }
}

// MCP handler
async function handleMCP(request: any, env: Env, ctx: ExecutionContext): Promise<any> {
  const { method, params } = request;
  
  switch (method) {
    case 'tools/list':
      return {
        tools: [
          { name: 'agent_chat', description: 'Send a message to Maxi' },
          { name: 'agent_voice', description: 'Generate voice response' },
          { name: 'agent_search', description: 'Search knowledge base' },
          { name: 'agent_mood_check', description: 'Check in on mood' },
          { name: 'agent_journal', description: 'Guided journaling' },
        ],
      };
    
    case 'tools/call':
      const { name, arguments: args } = params;
      switch (name) {
        case 'agent_chat':
          return handleChat(args, env, ctx);
        case 'agent_voice':
          const audio = await synthesizeVoice(args.text, env);
          return { success: true, audioLength: audio.byteLength };
        case 'agent_search':
          return { results: await searchKnowledge(args.query, env) };
        default:
          return { error: `Unknown tool: ${name}` };
      }
    
    default:
      return { error: `Unknown method: ${method}` };
  }
}

// Agent stats
async function getAgentStats(env: Env): Promise<any> {
  const sessionsRaw = await env.AGENT_STORE.get('stats:sessions');
  const messagesRaw = await env.AGENT_STORE.get('stats:messages');
  
  return {
    agent: env.AGENT_NAME,
    status: 'active',
    sessions: sessionsRaw ? parseInt(sessionsRaw) : 0,
    messages: messagesRaw ? parseInt(messagesRaw) : 0,
    uptime: '24/7',
    model: `${env.LLM_PROVIDER}/${env.LLM_MODEL}`,
    tts: env.TTS_PROVIDER,
  };
}

// Helper
function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
