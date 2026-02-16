import { NextResponse } from "next/server";
import { getSystemConfig, setSystemConfig } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const config = await getSystemConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      useRag?: boolean;
      topK?: number;
    };

    const config = await setSystemConfig({
      prompt: typeof body.prompt === "string" ? body.prompt : undefined,
      useRag: body.useRag,
      topK: body.topK
    });

    return NextResponse.json(config);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}
