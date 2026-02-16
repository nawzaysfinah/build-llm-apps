"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { SystemModal } from "@/components/system-modal";
import type { ChatMessage, RagDocument, SessionSummary, SystemConfig } from "@/lib/types";

type RagStatus = {
  documentCount: number;
  chunkCount: number;
  documents: RagDocument[];
};

const defaultSystem: SystemConfig = {
  prompt: "You are a helpful assistant.",
  useRag: true,
  topK: 5
};

const createSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const makeClientMessage = (role: "user" | "assistant", content: string): ChatMessage => ({
  id: createSessionId(),
  role,
  content,
  createdAt: new Date().toISOString()
});

export function ChatShell() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>(createSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(defaultSystem);
  const [rag, setRag] = useState<RagStatus>({ documentCount: 0, chunkCount: 0, documents: [] });
  const [showSystem, setShowSystem] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSessions = async () => {
    const res = await fetch("/api/history", { cache: "no-store" });
    const data = (await res.json()) as { sessions: SessionSummary[] };
    setSessions(data.sessions || []);
    return data.sessions || [];
  };

  const fetchMessages = async (sessionId: string) => {
    const res = await fetch(`/api/history?session_id=${encodeURIComponent(sessionId)}`, {
      cache: "no-store"
    });
    const data = (await res.json()) as { messages: ChatMessage[] };
    setMessages(data.messages || []);
  };

  const fetchSystem = async () => {
    const res = await fetch("/api/system", { cache: "no-store" });
    const data = (await res.json()) as SystemConfig;
    setSystemConfig(data);
  };

  const fetchRag = async () => {
    const res = await fetch("/api/rag/status", { cache: "no-store" });
    const data = (await res.json()) as RagStatus;
    setRag(data);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [loadedSessions] = await Promise.all([
          fetchSessions(),
          fetchSystem(),
          fetchRag()
        ]);

        if (loadedSessions.length) {
          const first = loadedSessions[0].id;
          setActiveSessionId(first);
          await fetchMessages(first);
        }
      } catch {
        setErrorText("Failed to load initial data.");
      }
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!scrollRef.current || !stickToBottom) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, stickToBottom]);

  const groupedSourcesHint = useMemo(() => {
    if (!rag.documentCount) return "RAG: no docs indexed";
    return `RAG: ${rag.documentCount} docs indexed`;
  }, [rag.documentCount]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setErrorText("");
    setStatusText("");
    setInput("");

    const user = makeClientMessage("user", text);
    const assistant = makeClientMessage("assistant", "");
    const assistantId = assistant.id;

    setMessages((prev) => [...prev, user, assistant]);

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: activeSessionId, message: text }),
        signal: controller.signal
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const message = data.error || "Chat request failed.";
        setErrorText(message);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: `[Error] ${message}` } : m))
        );
        return;
      }

      if (!res.body) {
        setErrorText("No stream body returned by server.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const token = decoder.decode(value, { stream: true });
        if (!token) continue;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: m.content + token
                }
              : m
          )
        );
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setStatusText("Generation stopped.");
      } else {
        setErrorText("Generation failed. Check Ollama and model availability.");
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      await fetchSessions();
    }
  };

  const stopGenerating = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await sendMessage();
  };

  const handleUpload = async (file: File) => {
    setErrorText("");
    setStatusText(`Uploading ${file.name}...`);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/rag/upload", {
        method: "POST",
        body: fd
      });

      const data = (await res.json()) as { error?: string; chunkCount?: number };
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      setStatusText(`Indexed ${file.name} (${data.chunkCount ?? 0} chunks).`);
      await fetchRag();
    } catch (error) {
      setErrorText((error as Error).message);
    }
  };

  const saveSystem = async (next: SystemConfig) => {
    const res = await fetch("/api/system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next)
    });

    if (!res.ok) {
      throw new Error("Failed to save system config.");
    }

    const data = (await res.json()) as SystemConfig;
    setSystemConfig(data);
    setStatusText("System settings saved.");
  };

  const clearRag = async () => {
    const confirmed = window.confirm("Clear all indexed documents?");
    if (!confirmed) return;

    await fetch("/api/rag/status", { method: "DELETE" });
    await fetchRag();
    setStatusText("RAG index cleared.");
  };

  const clearCurrentSession = async () => {
    if (!activeSessionId) return;

    await fetch("/api/history/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: activeSessionId })
    });

    setMessages([]);
    const nextId = createSessionId();
    setActiveSessionId(nextId);
    await fetchSessions();
  };

  return (
    <div className="min-h-screen bg-ink text-gray-100">
      <div className="mx-auto flex h-screen max-w-[1400px] overflow-hidden p-4">
        <aside className="hidden w-72 shrink-0 flex-col rounded-2xl border border-borderSoft bg-panel p-3 shadow-soft md:flex">
          <button
            type="button"
            onClick={() => {
              setActiveSessionId(createSessionId());
              setMessages([]);
              setStatusText("New chat ready.");
            }}
            className="mb-3 rounded-xl bg-userBubble px-3 py-2 text-sm font-semibold text-white"
          >
            + New chat
          </button>

          <div className="mb-3 rounded-xl border border-borderSoft bg-panelSoft p-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-gray-300">Knowledge</div>
            <div className="mb-3 text-sm text-gray-200">{groupedSourcesHint}</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleUpload(file);
                  e.currentTarget.value = "";
                }
              }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-borderSoft px-3 py-1.5 text-xs hover:bg-panel"
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => void clearRag()}
                className="rounded-md border border-borderSoft px-3 py-1.5 text-xs hover:bg-panel"
              >
                Clear index
              </button>
            </div>
            <div className="mt-2 max-h-24 overflow-auto text-xs text-gray-400">
              {rag.documents.map((doc) => (
                <div key={doc.id} className="truncate">
                  {doc.name} ({doc.chunkCount})
                </div>
              ))}
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-gray-400">
            <span>Sessions</span>
            <button
              type="button"
              onClick={() => setShowSystem(true)}
              className="rounded border border-borderSoft px-2 py-0.5 text-[11px] hover:bg-panelSoft"
            >
              System
            </button>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto pr-1">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={async () => {
                  setActiveSessionId(session.id);
                  await fetchMessages(session.id);
                }}
                className={`w-full rounded-lg border px-2 py-2 text-left text-xs transition ${
                  session.id === activeSessionId
                    ? "border-userBubble bg-panelSoft"
                    : "border-transparent hover:border-borderSoft hover:bg-panelSoft"
                }`}
              >
                <div className="truncate text-gray-100">{session.preview}</div>
                <div className="mt-0.5 text-[10px] text-gray-400">
                  {new Date(session.updatedAt).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="ml-0 flex min-w-0 flex-1 flex-col md:ml-4">
          <div
            ref={scrollRef}
            onScroll={(e) => {
              const target = e.currentTarget;
              const nearBottom =
                target.scrollHeight - target.scrollTop - target.clientHeight < 120;
              setStickToBottom(nearBottom);
            }}
            className="flex-1 overflow-y-auto pb-32"
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-2 pt-6 sm:px-4">
              {messages.length === 0 && (
                <div className="rounded-2xl border border-borderSoft bg-panel p-8 text-center text-sm text-gray-300">
                  Ask anything. Upload PDFs/TXT in the sidebar to enable local RAG.
                </div>
              )}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7 ${
                      m.role === "user"
                        ? "bg-userBubble text-white"
                        : "border border-borderSoft bg-assistBubble text-gray-100"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-borderSoft bg-ink/95 backdrop-blur">
            <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl px-2 py-3 sm:px-4">
              <div className="rounded-2xl border border-borderSoft bg-panel p-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={3}
                  placeholder="Message qwen3:latest..."
                  className="mb-3 w-full resize-none bg-transparent text-sm text-white outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                />

                <div className="flex items-center justify-between gap-2">
                  <div className="min-h-5 text-xs text-gray-400">
                    {errorText ? (
                      <span className="text-red-300">{errorText}</span>
                    ) : (
                      statusText
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void clearCurrentSession()}
                      className="rounded-lg border border-borderSoft px-3 py-1.5 text-xs text-gray-200 hover:bg-panelSoft"
                    >
                      Clear chat
                    </button>

                    {isStreaming ? (
                      <button
                        type="button"
                        onClick={stopGenerating}
                        className="rounded-lg border border-borderSoft px-3 py-1.5 text-xs text-gray-200 hover:bg-panelSoft"
                      >
                        Stop generating
                      </button>
                    ) : null}

                    <button
                      type="submit"
                      disabled={isStreaming || !input.trim()}
                      className="rounded-lg bg-userBubble px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>

      <SystemModal
        open={showSystem}
        value={systemConfig}
        onClose={() => setShowSystem(false)}
        onSave={saveSystem}
      />
    </div>
  );
}
