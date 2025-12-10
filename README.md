# Maxi - Wellness Coach AI Agent

<p align="center">
  <img src="public/assets/maxi/thumbnail.png" alt="Maxi" width="200" />
</p>

**Maxi** is an AI wellness coach specializing in mental health, psychology, relationships, dating, and personal growth. Built with the pow3r.abi Agent Creation Workflow.

## ✨ Features

- 💬 **Intelligent Chat** - Deep conversations about relationships, mental health, and personal growth
- 🎙️ **Voice Mode** - ElevenLabs TTS with YAIP prosody optimization
- 🎭 **3D Visual Avatar** - Viseme-based lip sync with emotional expressions
- 📚 **Knowledge Base** - Psychology, relationships, behavior change expertise
- 🔧 **MCP Integration** - Model Context Protocol tools for extensibility
- 📱 **PWA Support** - Install as native app on any device

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Deploy to Cloudflare
npm run deploy
```

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `XAI_API_KEY` | xAI/Grok API key | Yes |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS API key | Yes |
| `CF_ACCOUNT_ID` | Cloudflare account ID | For deployment |
| `CF_API_TOKEN` | Cloudflare API token | For deployment |

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│    maxi.superbots.link (PWA)       │
│         Cloudflare Pages            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│       Cloudflare Workers           │
│  ┌──────────────┐ ┌──────────────┐ │
│  │ Orchestrator │ │  MCP Server  │ │
│  │  (Grok-2)    │ │              │ │
│  └──────────────┘ └──────────────┘ │
└──────────────┬──────────────────────┘
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│   KV    │ │Vectorize│ │   R2    │
│(Config) │ │(Vectors)│ │(Assets) │
└─────────┘ └─────────┘ └─────────┘
```

## 🛠️ MCP Tools

| Tool | Description |
|------|-------------|
| `agent_chat` | Send chat message with knowledge context |
| `agent_voice` | Generate YAIP-processed voice response |
| `agent_search` | Search Maxi's knowledge base |
| `agent_journal` | Guided journaling prompts |
| `agent_mood_check` | Track and analyze mood patterns |
| `agent_goal_track` | Personal goal setting and tracking |

## 🎨 Persona

Maxi combines warmth with directness - supportive but honest. Key traits:

- **Compassionate** - Truly cares about your wellbeing
- **Direct** - Won't sugarcoat, delivers truth with care
- **Knowledgeable** - Deep expertise in psychology and relationships
- **Non-judgmental** - Safe space for all topics
- **Empowering** - Helps you make better decisions

> "It's ok, I require my friends to be honest with me." - Maxi

## 📁 Project Structure

```
maxi-agent/
├── configs/
│   └── agent.json        # Agent configuration
├── public/
│   ├── assets/maxi/      # Avatar assets
│   ├── icons/            # PWA icons
│   └── manifest.json     # PWA manifest
├── src/
│   ├── components/       # React components
│   ├── services/         # API services
│   └── utils/            # Utilities
├── workers/
│   ├── orchestrator/     # Main worker
│   └── mcp/              # MCP server
├── wrangler.toml         # Cloudflare config
└── package.json
```

## 🚀 Deployment

### Prerequisites

1. Cloudflare account with Workers & Pages
2. Wrangler CLI (`npm install -g wrangler`)
3. xAI API key for Grok-2
4. ElevenLabs API key for TTS

### Deploy Steps

```bash
# Login to Cloudflare
wrangler login

# Create KV namespace
wrangler kv:namespace create MAXI_STORE
# Update wrangler.toml with namespace ID

# Create Vectorize index
wrangler vectorize create maxi-vectors --dimensions=768 --metric=cosine

# Deploy workers
npm run deploy:workers

# Deploy pages
npm run deploy:pages

# Configure custom domain
# Add maxi.superbots.link in Cloudflare Pages settings
```

## 🧪 Development

```bash
# Start local development
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## 📜 License

MIT © Memory Music LLC

---

*Built with ❤️ using [pow3r.abi](https://abi.superbots.link)*
