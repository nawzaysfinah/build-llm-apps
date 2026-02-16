import fs from "fs/promises";
import path from "path";
import { DEFAULT_SYSTEM_PROMPT, env } from "@/lib/env";
import { makeId } from "@/lib/ids";
import type {
  ChatSession,
  ChatMessage,
  ChatRole,
  ChatsFile,
  RagIndexFile,
  SessionSummary,
  SystemConfig
} from "@/lib/types";

const systemPath = path.join(env.dataDir, "system_prompt.json");
const chatsPath = path.join(env.dataDir, "chats.json");
const ragPath = path.join(env.dataDir, "rag_index.json");

const defaultSystem = (): SystemConfig => ({
  prompt: DEFAULT_SYSTEM_PROMPT,
  useRag: true,
  topK: env.ragTopK
});

const defaultChats = (): ChatsFile => ({ sessions: {} });

const defaultRag = (): RagIndexFile => ({ documents: [], chunks: [] });

const ensureFile = async <T>(filePath: string, fallback: T): Promise<void> => {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), "utf8");
  }
};

export const ensureDataFiles = async (): Promise<void> => {
  await fs.mkdir(env.dataDir, { recursive: true });
  await ensureFile(systemPath, defaultSystem());
  await ensureFile(chatsPath, defaultChats());
  await ensureFile(ragPath, defaultRag());
};

const readJson = async <T>(filePath: string, fallback: T): Promise<T> => {
  await ensureDataFiles();
  try {
    const text = await fs.readFile(filePath, "utf8");
    if (!text.trim()) {
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await ensureDataFiles();
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
};

export const getSystemConfig = async (): Promise<SystemConfig> => {
  const cfg = await readJson<SystemConfig>(systemPath, defaultSystem());
  return {
    prompt: cfg.prompt || DEFAULT_SYSTEM_PROMPT,
    useRag: typeof cfg.useRag === "boolean" ? cfg.useRag : true,
    topK: Number.isFinite(cfg.topK) ? cfg.topK : env.ragTopK
  };
};

export const setSystemConfig = async (
  patch: Partial<SystemConfig>
): Promise<SystemConfig> => {
  const current = await getSystemConfig();
  const next: SystemConfig = {
    prompt: patch.prompt ?? current.prompt,
    useRag: typeof patch.useRag === "boolean" ? patch.useRag : current.useRag,
    topK:
      typeof patch.topK === "number" && patch.topK > 0
        ? Math.max(1, Math.min(12, Math.floor(patch.topK)))
        : current.topK
  };
  await writeJson(systemPath, next);
  return next;
};

export const getChats = async (): Promise<ChatsFile> => {
  return readJson<ChatsFile>(chatsPath, defaultChats());
};

export const listSessionSummaries = async (): Promise<SessionSummary[]> => {
  const chats = await getChats();
  return Object.values(chats.sessions)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((session) => {
      const last = session.messages[session.messages.length - 1];
      const preview = last ? last.content.replace(/\s+/g, " ").slice(0, 80) : "New chat";
      return {
        id: session.id,
        updatedAt: session.updatedAt,
        preview
      };
    });
};

export const getSessionMessages = async (sessionId: string): Promise<ChatMessage[]> => {
  const chats = await getChats();
  return chats.sessions[sessionId]?.messages ?? [];
};

export const appendMessage = async (
  sessionId: string,
  role: ChatRole,
  content: string
): Promise<ChatMessage> => {
  const chats = await getChats();
  const now = new Date().toISOString();
  const session =
    chats.sessions[sessionId] ??
    ({
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      messages: []
    } as ChatSession);

  const message: ChatMessage = {
    id: makeId(),
    role,
    content,
    createdAt: now
  };

  chats.sessions[sessionId] = {
    ...session,
    updatedAt: now,
    messages: [...session.messages, message]
  };

  await writeJson(chatsPath, chats);
  return message;
};

export const clearSession = async (sessionId: string): Promise<void> => {
  const chats = await getChats();
  delete chats.sessions[sessionId];
  await writeJson(chatsPath, chats);
};

export const clearAllSessions = async (): Promise<void> => {
  await writeJson(chatsPath, defaultChats());
};

export const getRagIndex = async (): Promise<RagIndexFile> => {
  return readJson<RagIndexFile>(ragPath, defaultRag());
};

export const setRagIndex = async (index: RagIndexFile): Promise<void> => {
  await writeJson(ragPath, index);
};

export const clearRagIndex = async (): Promise<void> => {
  await writeJson(ragPath, defaultRag());
};
