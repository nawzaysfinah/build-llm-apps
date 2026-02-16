import path from "path";

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const rawDataDir = process.env.DATA_DIR?.trim() || "./data";

export const env = {
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434",
  chatModel: process.env.OLLAMA_CHAT_MODEL?.trim() || "qwen3:latest",
  embedModel: process.env.OLLAMA_EMBED_MODEL?.trim() || "nomic-embed-text:latest",
  ragTopK: toInt(process.env.RAG_TOP_K, 5),
  maxHistoryTurns: toInt(process.env.MAX_HISTORY_TURNS, 20),
  dataDir: path.isAbsolute(rawDataDir) ? rawDataDir : path.resolve(process.cwd(), rawDataDir)
};

export const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";
