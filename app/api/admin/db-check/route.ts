import { NextResponse } from "next/server";
import { adminEmailFromRequest } from "@/lib/server/admin-session";
import { databaseUrl } from "@/lib/server/env";
import { pool } from "@/lib/server/fal-key";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

const RELATED = /POSTGRES|DATABASE|NEON|PGHOST|BLOB|RESEND|FAL|STORAGE/i;

// Variable names are not secret, values are. Only names ever leave the server.
function relatedNames(): string[] {
  return Object.keys(process.env)
    .filter((name) => RELATED.test(name))
    .sort();
}

function scrub(message: string): string {
  return message.replace(/postgres(ql)?:\/\/\S+/gi, "[hidden]").slice(0, 200);
}

export async function GET(req: Request) {
  if (!adminEmailFromRequest(req)) return fail("not-admin", 401);
  return NextResponse.json({ configured: Boolean(databaseUrl()), names: relatedNames() });
}

export async function POST(req: Request) {
  if (!adminEmailFromRequest(req)) return fail("not-admin", 401);
  if (!databaseUrl()) return NextResponse.json({ configured: false, ok: false, names: relatedNames() });
  try {
    const db = await pool();
    await db.query("SELECT 1");
    return NextResponse.json({ configured: true, ok: true, names: relatedNames() });
  } catch (e) {
    return NextResponse.json({
      configured: true,
      ok: false,
      detail: scrub(e instanceof Error ? e.message : String(e)),
      names: relatedNames(),
    });
  }
}
