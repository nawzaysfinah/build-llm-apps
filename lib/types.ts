export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatsFile {
  sessions: Record<string, ChatSession>;
}

export interface SessionSummary {
  id: string;
  updatedAt: string;
  preview: string;
}

export interface SystemConfig {
  prompt: string;
  useRag: boolean;
  topK: number;
}

export interface RagDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  chunkCount: number;
}

export interface RagChunk {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
}

export interface RagIndexFile {
  documents: RagDocument[];
  chunks: RagChunk[];
}

export interface RetrievedChunk extends RagChunk {
  score: number;
}
