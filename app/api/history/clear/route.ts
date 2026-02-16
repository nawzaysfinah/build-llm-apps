import { NextResponse } from "next/server";
import { clearAllSessions, clearSession } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { session_id?: string; clear_all?: boolean };

    if (body.clear_all || !body.session_id) {
      await clearAllSessions();
      return NextResponse.json({ ok: true, scope: "all" });
    }

    await clearSession(body.session_id);
    return NextResponse.json({ ok: true, scope: "session", session_id: body.session_id });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}
