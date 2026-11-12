import { signingSecret } from "@/lib/server/admin-session";
import { sha256 } from "@/lib/server/hmac";

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
};

const g = globalThis as unknown as {
  __falKeyPool?: Queryable;
  __falKeyMemory?: string | null;
};

export const dbUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;

export async function pool(): Promise<Queryable> {
  if (!g.__falKeyPool) {
    const mod = await import("pg");
    const PoolClass =
      (mod as { Pool?: new (o: object) => Queryable }).Pool ??
      (mod as { default: { Pool: new (o: object) => Queryable } }).default.Pool;
    g.__falKeyPool = new PoolClass({ connectionString: dbUrl(), max: 2 });
  }
  const db = g.__falKeyPool;
  await db.query(`CREATE TABLE IF NOT EXISTS city_games_secrets (id text PRIMARY KEY, value text NOT NULL)`);
  return db;
}

// Uses Web Crypto rather than node:crypto so the admin routes still load in
// runtimes that do not provide the Node crypto module.
async function cipherKey(): Promise<CryptoKey | null> {
  const secret = signingSecret();
  if (!secret) return null;
  const raw = sha256(new TextEncoder().encode(`luckypi-fal-key|${secret}`));
  return globalThis.crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export async function encrypt(plain: string): Promise<string | null> {
  try {
    const key = await cipherKey();
    if (!key) return null;
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const body = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      new TextEncoder().encode(plain),
    );
    return `${toB64(iv)}.${toB64(new Uint8Array(body))}`;
  } catch (e) {
    console.log("[v0] encrypt failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

export async function decrypt(payload: string): Promise<string | null> {
  try {
    const key = await cipherKey();
    if (!key) return null;
    const [iv, body] = payload.split(".").map(fromB64);
    const plain = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      body as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

async function readStored(): Promise<string | null> {
  if (!dbUrl()) return g.__falKeyMemory ?? null;
  try {
    const db = await pool();
    const res = await db.query("SELECT value FROM city_games_secrets WHERE id = 'fal_key'");
    if (res.rowCount === 0) return null;
    return await decrypt(String(res.rows[0].value));
  } catch (e) {
    console.log("[v0] fal key read failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Environment variable wins; otherwise the key saved from the admin panel. */
export async function getFalKey(): Promise<string | null> {
  const fromEnv = process.env.FAL_KEY?.trim();
  if (fromEnv) return fromEnv;
  return (await readStored())?.trim() || null;
}

export async function falKeyStatus() {
  const fromEnv = Boolean(process.env.FAL_KEY?.trim());
  const stored = await readStored();
  const canStore = Boolean(signingSecret());
  return {
    hasKey: fromEnv || Boolean(stored),
    source: fromEnv ? "env" : stored ? "admin" : "none",
    last4: stored ? stored.slice(-4) : null,
    persistent: Boolean(dbUrl()),
    canStore,
  };
}

export async function saveFalKey(key: string): Promise<"ok" | "no-secret" | "failed"> {
  const encrypted = await encrypt(key);
  if (!encrypted) return "no-secret";
  if (!dbUrl()) {
    g.__falKeyMemory = key;
    return "ok";
  }
  try {
    const db = await pool();
    await db.query(
      `INSERT INTO city_games_secrets (id, value) VALUES ('fal_key', $1)
       ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value`,
      [encrypted],
    );
    return "ok";
  } catch (e) {
    console.log("[v0] fal key save failed:", e instanceof Error ? e.message : String(e));
    return "failed";
  }
}

export async function clearFalKey(): Promise<void> {
  g.__falKeyMemory = null;
  if (!dbUrl()) return;
  try {
    const db = await pool();
    await db.query("DELETE FROM city_games_secrets WHERE id = 'fal_key'");
  } catch (e) {
    console.log("[v0] fal key clear failed:", e instanceof Error ? e.message : String(e));
  }
}
