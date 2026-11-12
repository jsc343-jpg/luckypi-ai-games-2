import { signingSecret } from "@/lib/server/admin-session";
import { dbUrl, decrypt, encrypt, pool } from "@/lib/server/fal-key";

const g = globalThis as unknown as { __resendMemory?: Record<string, string> };
const memory = () => (g.__resendMemory ??= {});

const KEY_ID = "resend_key";
const FROM_ID = "resend_from";

async function readStored(id: string): Promise<string | null> {
  if (!dbUrl()) return memory()[id] ?? null;
  try {
    const db = await pool();
    const res = await db.query("SELECT value FROM city_games_secrets WHERE id = $1", [id]);
    if (res.rowCount === 0) return null;
    return await decrypt(String(res.rows[0].value));
  } catch (e) {
    console.log("[v0] resend read failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function writeStored(id: string, value: string): Promise<"ok" | "no-secret" | "failed"> {
  const encrypted = await encrypt(value);
  if (!encrypted) return "no-secret";
  if (!dbUrl()) {
    memory()[id] = value;
    return "ok";
  }
  try {
    const db = await pool();
    await db.query(
      `INSERT INTO city_games_secrets (id, value) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value`,
      [id, encrypted],
    );
    return "ok";
  } catch (e) {
    console.log("[v0] resend save failed:", e instanceof Error ? e.message : String(e));
    return "failed";
  }
}

async function deleteStored(id: string): Promise<void> {
  delete memory()[id];
  if (!dbUrl()) return;
  try {
    const db = await pool();
    await db.query("DELETE FROM city_games_secrets WHERE id = $1", [id]);
  } catch (e) {
    console.log("[v0] resend clear failed:", e instanceof Error ? e.message : String(e));
  }
}

const envKey = () =>
  (process.env.RESEND_API_KEY || process.env.resend_api_key || process.env.Resend_Api_Key)?.trim() || null;

/** Environment variable wins; otherwise the key saved from the admin panel. */
export async function getResendKey(): Promise<string | null> {
  return envKey() || (await readStored(KEY_ID))?.trim() || null;
}

export async function getResendFrom(): Promise<string> {
  return (
    process.env.ADMIN_MAIL_FROM?.trim() ||
    (await readStored(FROM_ID))?.trim() ||
    "Luckypi AI Casino <onboarding@resend.dev>"
  );
}

export async function resendStatus() {
  const fromEnv = Boolean(envKey());
  const stored = await readStored(KEY_ID);
  const from = await readStored(FROM_ID);
  return {
    hasKey: fromEnv || Boolean(stored),
    source: fromEnv ? "env" : stored ? "admin" : "none",
    last4: stored ? stored.slice(-4) : null,
    from: process.env.ADMIN_MAIL_FROM?.trim() || from || null,
    fromSource: process.env.ADMIN_MAIL_FROM?.trim() ? "env" : from ? "admin" : "none",
    persistent: Boolean(dbUrl()),
    canStore: Boolean(signingSecret()),
  };
}

export async function saveResend(input: {
  key?: string;
  from?: string;
}): Promise<"ok" | "no-secret" | "failed"> {
  if (input.key) {
    const r = await writeStored(KEY_ID, input.key);
    if (r !== "ok") return r;
  }
  if (input.from) {
    const r = await writeStored(FROM_ID, input.from);
    if (r !== "ok") return r;
  }
  return "ok";
}

export async function clearResend(): Promise<void> {
  await deleteStored(KEY_ID);
  await deleteStored(FROM_ID);
}
