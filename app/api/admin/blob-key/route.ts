import { NextResponse } from "next/server";
import { adminEmailFromRequest } from "@/lib/server/admin-session";
import { blobKeyStatus, clearBlobKey, saveBlobKey } from "@/lib/server/blob-key";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req: Request) {
  if (!adminEmailFromRequest(req)) return fail("not-admin", 401);
  return NextResponse.json(await blobKeyStatus());
}

export async function POST(req: Request) {
  if (!adminEmailFromRequest(req)) return fail("not-admin", 401);
  const body = (await req.json().catch(() => null)) as { action?: string; key?: string } | null;

  if (body?.action === "clear") {
    await clearBlobKey();
    return NextResponse.json(await blobKeyStatus());
  }

  const key = body?.key?.trim() ?? "";
  if (!key.startsWith("vercel_blob_rw_") || /\s/.test(key)) return fail("invalid-key");
  const result = await saveBlobKey(key);
  if (result === "no-secret") return fail("no-secret", 503);
  if (result === "failed") return fail("save-failed", 500);
  return NextResponse.json(await blobKeyStatus());
}
