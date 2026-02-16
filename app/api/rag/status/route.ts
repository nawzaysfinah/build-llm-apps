import { NextResponse } from "next/server";
import { clearRagIndex, getRagIndex } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const index = await getRagIndex();
  return NextResponse.json({
    documentCount: index.documents.length,
    chunkCount: index.chunks.length,
    documents: index.documents
  });
}

export async function DELETE() {
  await clearRagIndex();
  return NextResponse.json({ ok: true });
}
