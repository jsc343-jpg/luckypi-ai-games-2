import { NextResponse } from "next/server";
import { adminEmailFromRequest } from "@/lib/server/admin-session";
import { databaseUrl, isPostgresUrl, setRuntimeDatabaseUrl } from "@/lib/server/env";
import { pool } from "@/lib/server/fal-key";
import { loadStore } from "@/lib/server/persist";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

const globals = globalThis as unknown as {
  __falKeyPool?: { end?: () => Promise<void> };
  __cityGamesPool?: { end?: () => Promise<void> };
  __cityGamesReady?: Promise<void>;
  __cityGamesVersion?: number;
};

// Pools keep the old address, so drop them whenever the address changes.
async function resetPools() {
  const old = [globals.__falKeyPool, globals.__cityGamesPool];
  globals.__falKeyPool = undefined;
  globals.__cityGamesPool = undefined;
  globals.__cityGamesReady = undefined;
  globals.__cityGamesVersion = undefined;
  await Promise.all(old.map((p) => p?.end?.().catch(() => undefined)));
}

function scrub(message: string): string {
  return message.replace(/postgres(ql)?:\/\/\S+/gi, "[hidden]").slice(0, 200);
}

export async function POST(req: Request) {
  if (!adminEmailFromRequest(req)) return fail("not-admin", 401);
  const body = (await req.json().catch(() => ({}))) as { url?: unknown; clear?: unknown };

  if (body.clear === true) {
    setRuntimeDatabaseUrl(null);
    await resetPools();
    return NextResponse.json({ ok: true, configured: Boolean(databaseUrl()) });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!isPostgresUrl(url)) return fail("bad-url");

  setRuntimeDatabaseUrl(url);
  await resetPools();
  try {
    const db = await pool();
    await db.query("SELECT 1");
    await loadStore();
    return NextResponse.json({ ok: true, configured: true });
  } catch (e) {
    setRuntimeDatabaseUrl(null);
    await resetPools();
    return NextResponse.json({
      ok: false,
      configured: false,
      detail: scrub(e instanceof Error ? e.message : String(e)),
    });
  }
}
