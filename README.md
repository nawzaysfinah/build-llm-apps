# build-llm-apps

> A complete, local-first LLM chat app with RAG — built as a teaching reference for students learning to build with AI. No cloud API required.

![TypeScript](https://img.shields.io/badge/TypeScript-98%25-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-App_Router-black?logo=nextdotjs)
![LangChain](https://img.shields.io/badge/LangChain-JS-1C3C3C?logo=langchain)
![Ollama](https://img.shields.io/badge/Ollama-local_LLM-black)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Why This Exists

Teaching LLM app development is harder than it sounds. Most tutorials either require a paid OpenAI key (creating friction for students) or are too shallow to show how real apps work.

This repo is the reference implementation I use with students at ITE College West. It's a complete ChatGPT-like app that runs entirely on local hardware — every concept from the chat loop to RAG retrieval is visible and editable in the code.

**Students can clone it, run it on their own machine for free, and learn by breaking it.**

---

## What It Demonstrates

This isn't just a chat wrapper. It covers the full stack of patterns you need for real LLM apps:

| Concept | Where to find it |
|---|---|
| Streaming LLM responses | `app/api/chat/route.ts` |
| Chat history & session management | `app/api/history/` + `data/chats.json` |
| System prompt configuration | `app/api/system/` |
| Document chunking (PDF/TXT) | `app/api/rag/upload/route.ts` |
| Embedding + cosine similarity retrieval | `lib/rag.ts` |
| Source citation in responses | `components/ChatMessage.tsx` |
| Configurable RAG parameters (Top-K) | `.env` + `app/api/system/` |

---

## How It Works

```
User uploads PDF/TXT
        │
        ▼
  Text extraction
        │
        ▼
  Chunking (RecursiveCharacterTextSplitter)
        │
        ▼
  Ollama embeddings (nomic-embed-text)
        │
        ▼
  Stored in data/rag_index.json
        
        
User sends message
        │
        ▼
  Query embedding
        │
        ▼
  Cosine similarity → Top-K chunks retrieved
        │
        ▼
  Chunks injected into system prompt
        │
        ▼
  LangChain → Ollama (qwen3) → Streaming response
        │
        ▼
  "Sources: doc.pdf [chunk 3, 7]" appended
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| LLM orchestration | LangChain JS |
| LLM inference | Ollama (`qwen3:latest`) |
| Embeddings | Ollama (`nomic-embed-text`) |
| Styling | Tailwind CSS |
| Persistence | Local JSON files (no database) |

Everything runs locally. No API keys, no cloud costs.

---

## Features

- **ChatGPT-style UI** — sidebar + centered chat + sticky composer
- **Streaming responses** — token-by-token output
- **Session history** — multiple conversations, "New chat" to reset
- **Editable system prompt** — change the assistant's behaviour at runtime
- **RAG toggle** — enable/disable document context per session
- **PDF + TXT upload** — index documents, get cited responses
- **Configurable Top-K** — tune retrieval depth from the UI
- **Friendly error messages** — Ollama not running? The app tells you exactly what to do

---

## Prerequisites

- Node.js 18+
- [Ollama](https://ollama.ai) running locally

Pull the required models:

```bash
ollama pull qwen3:latest
ollama pull nomic-embed-text:latest
```

---

## Quickstart

```bash
git clone https://github.com/nawzaysfinah/build-llm-apps.git
cd build-llm-apps
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration

All settings live in `.env`:

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen3:latest       # swap for any model you have pulled
OLLAMA_EMBED_MODEL=nomic-embed-text:latest
RAG_TOP_K=5                          # chunks retrieved per query
MAX_HISTORY_TURNS=20                 # messages kept in context
DATA_DIR=./data                      # where JSON files are stored
```

To swap models: edit `.env` and restart `npm run dev`.

---

## API Reference

| Method | Route | What it does |
|---|---|---|
| `POST` | `/api/chat` | Streaming chat response |
| `GET` | `/api/history` | List all sessions |
| `GET` | `/api/history?session_id=...` | Get messages for a session |
| `POST` | `/api/history/clear` | Clear one session or all |
| `GET` | `/api/system` | Get system config |
| `POST` | `/api/system` | Update system prompt / RAG settings |
| `POST` | `/api/rag/upload` | Upload + index PDF or TXT |
| `GET` | `/api/rag/status` | List indexed documents and chunk count |
| `DELETE` | `/api/rag/status` | Clear the RAG index |

Test streaming directly:

```bash
curl -N http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","message":"Explain RAG in one sentence"}'
```

---

## Data Persistence

The app auto-creates these files under `data/`:

```
data/
├── system_prompt.json   # current system prompt + RAG config
├── chats.json           # all session histories
└── rag_index.json       # embedded chunks + vectors
```

No database setup required — useful in teaching contexts where students just want to run the code.

---

## Troubleshooting

**Cannot connect to Ollama** — Start Ollama, then verify: `curl http://localhost:11434/api/tags`

**Model not found** — Run `ollama pull qwen3:latest` and `ollama pull nomic-embed-text:latest`

**PDF upload fails** — Use text-based PDFs (not scanned images). For scanned PDFs, see [`pdf-knowledge-graph-pipeline`](https://github.com/nawzaysfinah/pdf-knowledge-graph-pipeline) which adds OCR support.

**Windows path issues** — Keep `DATA_DIR=./data` as a relative path.

---

## Project Structure

```
build-llm-apps/
├── app/
│   ├── api/
│   │   ├── chat/          # streaming chat endpoint
│   │   ├── history/       # session management
│   │   ├── rag/           # upload + retrieval
│   │   └── system/        # config management
│   └── page.tsx           # main chat UI
├── components/            # React UI components
├── lib/                   # RAG logic, LangChain setup
├── types/                 # TypeScript type definitions
├── data/                  # auto-created JSON persistence
└── .env.example
```

---

## Related Projects

- [`local-pdf-rag`](https://github.com/nawzaysfinah/local-pdf-rag) — stripped-down RAG for privacy-sensitive use cases (no UI, just the pipeline)
- [`pdf-knowledge-graph-pipeline`](https://github.com/nawzaysfinah/pdf-knowledge-graph-pipeline) — takes RAG further with Neo4j knowledge graphs for multi-hop queries

---

*Built by [Syaz](https://syaz.super.site) — AI Lecturer @ ITE College West, Singapore*
