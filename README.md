# UE5 AI Studio

**AI-Powered Development Assistant for Unreal Engine 5**

[![CI/CD](https://github.com/mtc-jordan/UE5_AGENT/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/mtc-jordan/UE5_AGENT/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.1.0-green.svg)](https://github.com/mtc-jordan/UE5_AGENT/releases)

---

## 🚀 Overview

UE5 AI Studio is a comprehensive AI-powered platform that enhances Unreal Engine 5 development through intelligent assistance, automation, and real-time collaboration. Built with FastAPI (backend) and React (frontend), it provides seamless integration with multiple AI providers and advanced development tools.

### ✨ Key Features

- 🤖 **20 AI Models** - DeepSeek, Google Gemini, Anthropic Claude, OpenAI
- 🔌 **Native API Clients** - Direct integration with each provider's SDK
- 💬 **Real-time Chat** - WebSocket-based AI chat with streaming responses
- 🎨 **Modern UI** - Enhanced interface with model selector and quick actions
- 🔐 **Authentication** - JWT-based auth with admin roles
- 📊 **Monitoring** - Health monitoring and performance metrics
- 🐳 **Docker Support** - Full containerization
- 🚀 **CI/CD Pipeline** - Automated testing and deployment
- 🔧 **101 MCP Tools** - Model Context Protocol for UE5 integration

---

## 📋 Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/mtc-jordan/UE5_AGENT.git
cd UE5_AGENT

# Configure environment
cp .env.example .env
nano .env

# Start services
docker-compose up -d

# Check status
docker-compose ps
```

### Access

- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## 🤖 AI Models (20 Total)

### DeepSeek (3 models)
- `deepseek-chat` - DeepSeek V3
- `deepseek-reasoner` - DeepSeek R1
- `deepseek-coder` - Code specialized

### Google Gemini (5 models)
- `gemini-3-pro`, `gemini-3-flash` - Latest
- `gemini-2.5-pro`, `gemini-2.5-flash` - Stable
- `gemini-2.0-flash` - Previous gen

### Anthropic Claude (5 models)
- `claude-4-sonnet`, `claude-4-opus`, `claude-4-haiku` - Claude 4.5
- `claude-3-5-sonnet`, `claude-3-opus` - Claude 3

### OpenAI (7 models)
- `gpt-5.2-chat`, `gpt-5.2-pro`, `gpt-5.1-codex` - GPT-5
- `gpt-4o`, `gpt-4o-mini` - GPT-4
- `gpt-4.1-mini`, `gpt-4.1-nano` - GPT-4.1

---

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
┌──────▼──────────────────────────────────────┐
│           Nginx (Frontend)                  │
└──────┬──────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────┐
│           FastAPI Backend                   │
│  ┌────────────────────────────────────────┐ │
│  │  AI Chat Service (20 Models)          │ │
│  │  - Native DeepSeek (httpx)            │ │
│  │  - Native Gemini (google-ai)          │ │
│  │  - Native Claude (anthropic)          │ │
│  │  - Native OpenAI (openai)             │ │
│  └────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────┐ │
│  │  Core Services                         │ │
│  │  - Auth  - Projects  - Memory          │ │
│  │  - MCP   - Monitoring - Admin          │ │
│  └────────────────────────────────────────┘ │
└──────┬────────────────────┬─────────────────┘
       │                    │
┌──────▼──────┐      ┌──────▼──────┐
│ PostgreSQL  │      │    Redis    │
└─────────────┘      └─────────────┘
```

---

## 📚 Documentation

- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [API Documentation](http://localhost:8000/docs)
- [MCP Tools Reference](docs/MCP_TOOLS.md)
- [Contributing Guidelines](CONTRIBUTING.md)

---

## 🛠️ Development

### Backend

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🚀 Deployment

### Production Deploy

```bash
sudo ./scripts/deploy.sh
```

### Rollback

```bash
sudo ./scripts/rollback.sh
```

### Health Check

```bash
./scripts/health_check.sh
```

---

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:8000/api/monitoring/health
```

### Metrics (Admin)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/monitoring/metrics
```

---

## 🔧 Configuration

### API Keys

Configure in Settings UI or `.env`:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
DEEPSEEK_API_KEY=sk-...
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

- FastAPI, React, Unreal Engine
- OpenAI, Anthropic, Google, DeepSeek

---

**Built with ❤️ for the Unreal Engine community**

Version 2.1.0 | [Website](https://ue5studio.com) | [Discord](https://discord.gg/ue5studio)
