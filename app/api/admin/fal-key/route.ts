import { NextResponse } from "next/server";
import { adminEmailFromRequest } from "@/lib/server/admin-session";
import { clearFalKey, falKeyStatus, saveFalKey } from "@/lib/server/fal-key";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req: Request) {
  if (!adminEmailFromRequest(req)) return fail("not-admin", 401);
  return NextResponse.json(await falKeyStatus());
}

export async function POST(req: Request) {
  if (!adminEmailFromRequest(req)) return fail("not-admin", 401);
  const body = (await req.json().catch(() => null)) as { action?: string; key?: string } | null;

  if (body?.action === "clear") {
    await clearFalKey();
    return NextResponse.json(await falKeyStatus());
  }

  const key = body?.key?.trim() ?? "";
  if (key.length < 20 || /\s/.test(key)) return fail("invalid-key");
  const result = await saveFalKey(key);
  if (result === "no-secret") return fail("no-secret", 503);
  if (result === "failed") return fail("save-failed", 500);
  return NextResponse.json(await falKeyStatus());
}
