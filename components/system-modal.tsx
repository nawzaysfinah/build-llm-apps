"use client";

import { useEffect, useState } from "react";
import type { SystemConfig } from "@/lib/types";

interface SystemModalProps {
  open: boolean;
  value: SystemConfig;
  onClose: () => void;
  onSave: (next: SystemConfig) => Promise<void>;
}

export function SystemModal({ open, value, onClose, onSave }: SystemModalProps) {
  const [draft, setDraft] = useState<SystemConfig>(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-borderSoft bg-panel p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">System Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-borderSoft px-3 py-1 text-sm text-gray-200 hover:bg-panelSoft"
          >
            Close
          </button>
        </div>

        <label className="mb-2 block text-sm text-gray-300">System prompt</label>
        <textarea
          value={draft.prompt}
          onChange={(e) => setDraft((p) => ({ ...p, prompt: e.target.value }))}
          className="mb-4 h-40 w-full rounded-xl border border-borderSoft bg-panelSoft p-3 text-sm text-white outline-none ring-0"
        />

        <div className="mb-4 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={draft.useRag}
              onChange={(e) => setDraft((p) => ({ ...p, useRag: e.target.checked }))}
            />
            Use RAG
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-200">
            Top-K
            <input
              type="number"
              min={1}
              max={12}
              value={draft.topK}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  topK: Math.max(1, Math.min(12, Number(e.target.value) || 1))
                }))
              }
              className="w-20 rounded-md border border-borderSoft bg-panelSoft px-2 py-1 text-sm text-white"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(draft);
              onClose();
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-lg bg-userBubble px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
