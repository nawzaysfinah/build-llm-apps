import { NextResponse } from "next/server";
import { extractTextByMime, indexDocument } from "@/lib/rag";

export const runtime = "nodejs";

const ALLOWED = new Set(["application/pdf", "text/plain"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const mimeType = file.type || (ext === "pdf" ? "application/pdf" : "text/plain");

    if (!ALLOWED.has(mimeType) && !["txt", "pdf"].includes(ext)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload PDF or TXT." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const text = await extractTextByMime(mimeType, bytes);

    const result = await indexDocument({
      fileName: file.name,
      mimeType,
      size: file.size,
      text
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    const lower = message.toLowerCase();
    const status =
      lower.includes("model") || lower.includes("ollama") || lower.includes("timed out")
        ? 503
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
