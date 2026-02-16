import { NextResponse } from "next/server";
import { getSessionMessages, listSessionSummaries } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");

  if (sessionId) {
    const messages = await getSessionMessages(sessionId);
    return NextResponse.json({ session_id: sessionId, messages });
  }

  const sessions = await listSessionSummaries();
  return NextResponse.json({ sessions });
}
