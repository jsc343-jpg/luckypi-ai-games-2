import { decrypt, encrypt, pool } from "@/lib/server/fal-key";
import { blobToken, databaseUrl } from "@/lib/server/env";
import { signingSecret } from "@/lib/server/admin-session";

const g = globalThis as unknown as { __blobKeyMemory?: string | null };

async function readStored(): Promise<string | null> {
  if (!databaseUrl()) return g.__blobKeyMemory ?? null;
  try {
    const db = await pool();
    const res = await db.query("SELECT value FROM city_games_secrets WHERE id = 'blob_token'");
    if (res.rowCount === 0) return null;
    return await decrypt(String(res.rows[0].value));
  } catch (e) {
    console.log("[v0] blob token read failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Environment variable wins; otherwise the token saved from the admin panel. */
export async function getBlobToken(): Promise<string | null> {
  const fromEnv = blobToken()?.trim();
  if (fromEnv) return fromEnv;
  return (await readStored())?.trim() || null;
}

export async function blobKeyStatus() {
  const fromEnv = Boolean(blobToken()?.trim());
  const stored = await readStored();
  return {
    hasKey: fromEnv || Boolean(stored),
    source: fromEnv ? "env" : stored ? "admin" : "none",
    last4: stored ? stored.slice(-4) : null,
    persistent: Boolean(databaseUrl()),
    canStore: Boolean(signingSecret()),
  };
}

export async function saveBlobKey(token: string): Promise<"ok" | "no-secret" | "failed"> {
  const encrypted = await encrypt(token);
  if (!encrypted) return "no-secret";
  if (!databaseUrl()) {
    g.__blobKeyMemory = token;
    return "ok";
  }
  try {
    const db = await pool();
    await db.query(
      `INSERT INTO city_games_secrets (id, value) VALUES ('blob_token', $1)
       ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value`,
      [encrypted],
    );
    return "ok";
  } catch (e) {
    console.log("[v0] blob token save failed:", e instanceof Error ? e.message : String(e));
    return "failed";
  }
}

export async function clearBlobKey(): Promise<void> {
  g.__blobKeyMemory = null;
  if (!databaseUrl()) return;
  try {
    const db = await pool();
    await db.query("DELETE FROM city_games_secrets WHERE id = 'blob_token'");
  } catch (e) {
    console.log("[v0] blob token clear failed:", e instanceof Error ? e.message : String(e));
  }
}
