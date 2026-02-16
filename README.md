# Local LangChain + Ollama Chat (Next.js)

A minimal-but-real local ChatGPT-like web app using:
- Next.js App Router (single repo frontend + backend)
- LangChain JS + Ollama (`qwen3:latest`)
- Local JSON persistence (no database)
- Streaming responses
- Local file upload RAG (PDF + TXT)

## Features
- ChatGPT-style layout: sidebar + centered chat + sticky composer
- Streaming assistant output
- Session-based chat history with "New chat"
- Editable system prompt + RAG toggle + Top-K setting
- RAG indexing for PDF/TXT with Ollama embeddings
- Source citation suffix per response
- Friendly Ollama error messages

## Prerequisites
- Node.js 18+
- npm
- Ollama running locally at `http://localhost:11434`

Pull required models:
```bash
ollama pull qwen3:latest
ollama pull nomic-embed-text:latest
```

## Setup
```bash
npm install
cp .env.example .env
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

## Environment Variables
See `.env.example`:
- `OLLAMA_BASE_URL` default `http://localhost:11434`
- `OLLAMA_CHAT_MODEL` default `qwen3:latest`
- `OLLAMA_EMBED_MODEL` default `nomic-embed-text:latest`
- `RAG_TOP_K` default `5`
- `MAX_HISTORY_TURNS` default `20`
- `DATA_DIR` default `./data`

## API Routes
- `POST /api/chat` streaming text response
- `GET /api/history` list sessions
- `GET /api/history?session_id=...` get session messages
- `POST /api/history/clear` clear one session or all
- `GET /api/system` get system config
- `POST /api/system` update system config
- `POST /api/rag/upload` upload + index PDF/TXT
- `GET /api/rag/status` list indexed docs/chunks
- `DELETE /api/rag/status` clear index

## Persistence
Data is stored in local JSON files under `data/`:
- `data/system_prompt.json`
- `data/chats.json`
- `data/rag_index.json`

The app auto-creates these files.

## How RAG Works
1. Upload PDF/TXT.
2. Text is extracted and chunked (`RecursiveCharacterTextSplitter`).
3. Each chunk is embedded via Ollama embeddings model.
4. Chunks + vectors are saved in `data/rag_index.json`.
5. On each user query, query embedding is compared with chunk embeddings using cosine similarity.
6. Top-K chunks are injected into the system prompt context.
7. Assistant response appends `Sources: ...` using doc name + chunk index.

## Streaming Test with curl
```bash
curl -N http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id":"demo-session","message":"Hello from curl"}'
```

You should see response text stream progressively.

## Troubleshooting
- **Cannot connect to Ollama**
  - Start Ollama.
  - Confirm: `curl http://localhost:11434/api/tags`
- **Model not found**
  - Run:
    - `ollama pull qwen3:latest`
    - `ollama pull nomic-embed-text:latest`
- **PDF upload fails**
  - Try a text-based PDF first (not scanned image PDF).
- **Windows path issues**
  - Keep `DATA_DIR=./data` unless you need a custom absolute path.

## Change Models
Edit `.env`:
```env
OLLAMA_CHAT_MODEL=qwen3:latest
OLLAMA_EMBED_MODEL=nomic-embed-text:latest
```
Restart `npm run dev`.
