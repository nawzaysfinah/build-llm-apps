import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { env } from "@/lib/env";
import { buildEmbeddingsModel } from "@/lib/llm";
import { cosineSimilarity } from "@/lib/similarity";
import { makeId } from "@/lib/ids";
import { getRagIndex, setRagIndex } from "@/lib/storage";
import type { RagChunk, RagDocument, RetrievedChunk } from "@/lib/types";

const EMBED_TIMEOUT_MS = 20_000;

const normalizeText = (text: string): string => {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
};

export const extractTextByMime = async (
  mimeType: string,
  bytes: Buffer
): Promise<string> => {
  if (mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(bytes);
    return normalizeText(parsed.text || "");
  }

  return normalizeText(bytes.toString("utf8"));
};

const makeChunks = async (text: string): Promise<string[]> => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 180,
    separators: ["\n\n", "\n", ". ", " ", ""]
  });
  return splitter.splitText(text);
};

const withTimeout = async <T>(promise: Promise<T>, timeoutLabel: string): Promise<T> => {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `${timeoutLabel} timed out. Ensure Ollama is running and pull ${env.embedModel}.`
            )
          );
        }, EMBED_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const normalizeEmbeddingError = (error: unknown): Error => {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (lower.includes("not found") && lower.includes("model")) {
    return new Error(
      `Embedding model \"${env.embedModel}\" not found. Run: ollama pull ${env.embedModel}`
    );
  }

  if (lower.includes("econnrefused") || lower.includes("fetch failed")) {
    return new Error(
      `Cannot reach Ollama at ${env.ollamaBaseUrl}. Start Ollama and try again.`
    );
  }

  return new Error(raw);
};

export const indexDocument = async (params: {
  fileName: string;
  mimeType: string;
  size: number;
  text: string;
}) => {
  const normalized = normalizeText(params.text);
  if (!normalized) {
    throw new Error("No extractable text found in the uploaded file.");
  }

  const chunks = await makeChunks(normalized);
  if (!chunks.length) {
    throw new Error("Unable to generate chunks from this document.");
  }

  const embedder = buildEmbeddingsModel();
  let vectors: number[][];

  try {
    vectors = await withTimeout(
      embedder.embedDocuments(chunks),
      "Embedding request"
    );
  } catch (error) {
    throw normalizeEmbeddingError(error);
  }

  const now = new Date().toISOString();
  const docId = makeId();

  const doc: RagDocument = {
    id: docId,
    name: params.fileName,
    mimeType: params.mimeType,
    size: params.size,
    uploadedAt: now,
    chunkCount: chunks.length
  };

  const ragChunks: RagChunk[] = chunks.map((text, index) => ({
    id: makeId(),
    docId,
    docName: params.fileName,
    chunkIndex: index,
    text,
    embedding: vectors[index]
  }));

  const index = await getRagIndex();
  index.documents = [...index.documents, doc];
  index.chunks = [...index.chunks, ...ragChunks];

  await setRagIndex(index);

  return {
    document: doc,
    chunkCount: ragChunks.length
  };
};

export const retrieveChunks = async (query: string, topK: number): Promise<RetrievedChunk[]> => {
  const index = await getRagIndex();
  if (!query.trim() || !index.chunks.length) {
    return [];
  }

  const embedder = buildEmbeddingsModel();
  let queryEmbedding: number[];

  try {
    queryEmbedding = await withTimeout(
      embedder.embedQuery(query),
      "Query embedding request"
    );
  } catch (error) {
    throw normalizeEmbeddingError(error);
  }

  const scored = index.chunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, topK));

  return scored;
};
