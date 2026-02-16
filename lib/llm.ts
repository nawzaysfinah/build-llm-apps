import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { OllamaEmbeddings, ChatOllama } from "@langchain/ollama";
import { env } from "@/lib/env";
import type { ChatMessage, RetrievedChunk } from "@/lib/types";

export const buildChatModel = (): ChatOllama => {
  return new ChatOllama({
    baseUrl: env.ollamaBaseUrl,
    model: env.chatModel,
    temperature: 0.2
  });
};

export const buildEmbeddingsModel = (): OllamaEmbeddings => {
  return new OllamaEmbeddings({
    baseUrl: env.ollamaBaseUrl,
    model: env.embedModel
  });
};

const toHistoryMessages = (history: ChatMessage[], maxTurns: number) => {
  const maxMessages = Math.max(2, maxTurns * 2);
  const tail = history.slice(-maxMessages);

  return tail
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) =>
      m.role === "assistant" ? new AIMessage(m.content) : new HumanMessage(m.content)
    );
};

const formatRetrievedContext = (chunks: RetrievedChunk[]): string => {
  if (!chunks.length) {
    return "";
  }

  const lines = chunks.map(
    (chunk) =>
      `[${chunk.docName} / chunk ${chunk.chunkIndex}] ${chunk.text.slice(0, 1500).trim()}`
  );

  return [
    "Use the following retrieved context when relevant. If not relevant, ignore it. If you don't know, say so.",
    ...lines
  ].join("\n\n");
};

export const buildPromptMessages = (params: {
  systemPrompt: string;
  retrievedChunks: RetrievedChunk[];
  history: ChatMessage[];
  userMessage: string;
  maxHistoryTurns: number;
}) => {
  const contextBlock = formatRetrievedContext(params.retrievedChunks);
  const systemText = contextBlock
    ? `${params.systemPrompt}\n\n${contextBlock}`
    : params.systemPrompt;

  return [
    new SystemMessage(systemText),
    ...toHistoryMessages(params.history, params.maxHistoryTurns),
    new HumanMessage(params.userMessage)
  ];
};

export const formatSources = (chunks: RetrievedChunk[]): string => {
  if (!chunks.length) {
    return "\n\nSources: none";
  }

  const seen = new Set<string>();
  const labels: string[] = [];

  for (const chunk of chunks) {
    const label = `${chunk.docName} / chunk ${chunk.chunkIndex}`;
    if (!seen.has(label)) {
      labels.push(label);
      seen.add(label);
    }
  }

  return `\n\nSources: ${labels.join(", ")}`;
};
