import { NextResponse } from "next/server";
import { buildChatModel, buildPromptMessages, formatSources } from "@/lib/llm";
import { env } from "@/lib/env";
import { retrieveChunks } from "@/lib/rag";
import { appendMessage, getSessionMessages, getSystemConfig } from "@/lib/storage";

export const runtime = "nodejs";

const encoder = new TextEncoder();

const chunkToText = (chunk: unknown): string => {
  if (!chunk || typeof chunk !== "object") {
    return "";
  }

  const content = (chunk as { content?: unknown }).content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }

  return "";
};

const friendlyOllamaError = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes("econnrefused") ||
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch")
  ) {
    return {
      status: 503,
      message:
        "Cannot reach Ollama. Start Ollama, then run: `ollama pull qwen3:latest` and `ollama pull nomic-embed-text:latest`."
    };
  }

  if (lower.includes("model") && lower.includes("not found")) {
    return {
      status: 503,
      message:
        "Required Ollama model is missing. Run: `ollama pull qwen3:latest` and `ollama pull nomic-embed-text:latest`."
    };
  }

  return {
    status: 500,
    message: raw || "Chat generation failed."
  };
};

export async function POST(request: Request) {
  let sessionId = "";

  try {
    const body = (await request.json()) as { session_id?: string; message?: string };
    sessionId = body.session_id?.trim() || "";
    const userMessage = body.message?.trim() || "";

    if (!sessionId || !userMessage) {
      return NextResponse.json(
        { error: "session_id and message are required." },
        { status: 400 }
      );
    }

    const [systemConfig, history] = await Promise.all([
      getSystemConfig(),
      getSessionMessages(sessionId)
    ]);

    const retrieved =
      systemConfig.useRag && userMessage
        ? await retrieveChunks(userMessage, systemConfig.topK || env.ragTopK)
        : [];

    const messages = buildPromptMessages({
      systemPrompt: systemConfig.prompt,
      retrievedChunks: retrieved,
      history,
      userMessage,
      maxHistoryTurns: env.maxHistoryTurns
    });

    const model = buildChatModel();
    const llmStream = await model.stream(messages);

    await appendMessage(sessionId, "user", userMessage);

    let fullAssistantText = "";
    let aborted = false;
    let saved = false;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;

        const safeClose = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            // Stream may already be closed/canceled by client.
          }
        };

        const safeEnqueue = (text: string) => {
          if (!text || closed || aborted || request.signal.aborted) {
            return;
          }
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            aborted = true;
          }
        };

        const saveAssistantOnce = async (text: string) => {
          if (saved || !text.trim()) {
            return;
          }
          saved = true;
          await appendMessage(sessionId, "assistant", text);
        };

        try {
          for await (const chunk of llmStream) {
            if (aborted || request.signal.aborted) {
              aborted = true;
              break;
            }

            const token = chunkToText(chunk);
            if (token) {
              fullAssistantText += token;
              safeEnqueue(token);
            }
          }

          if (!aborted) {
            const sources = formatSources(retrieved);
            fullAssistantText += sources;
            safeEnqueue(sources);
          }

          await saveAssistantOnce(fullAssistantText);
          safeClose();
        } catch (error) {
          if (aborted || request.signal.aborted) {
            await saveAssistantOnce(fullAssistantText);
            safeClose();
            return;
          }

          const friendly = friendlyOllamaError(error);
          const tail = `\n\n[Error: ${friendly.message}]`;
          fullAssistantText += tail;
          await saveAssistantOnce(fullAssistantText);

          safeEnqueue(tail);
          safeClose();
        }
      },
      cancel() {
        aborted = true;
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    const friendly = friendlyOllamaError(error);
    return NextResponse.json({ error: friendly.message }, { status: friendly.status });
  }
}
