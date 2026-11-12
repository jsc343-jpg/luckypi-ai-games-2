import { constantTimeEqual, hmacSha256Hex } from "@/lib/server/hmac";

// Mirrors the signing used by the admin login route so that only a signed-in
// administrator can spend money on video generation.
export function signingSecret(): string | null {
  const resend = (process.env.RESEND_API_KEY || process.env.resend_api_key || process.env.Resend_Api_Key)?.trim();
  return (
    process.env.ADMIN_SETUP_KEY ||
    resend ||
    (process.env.NODE_ENV !== "production" ? "city-games-dev-secret" : null)
  );
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function adminEmailFromRequest(req: Request): string | null {
  const token = req.headers.get("x-admin-token") || readCookie(req, "cg_admin");
  const secret = signingSecret();
  if (!token || !secret) return null;
  const [mail, exp, sig] = token.split("|");
  if (!mail || !exp || !sig) return null;
  const expected = hmacSha256Hex(secret, `session|${mail}|${exp}`);
  if (!constantTimeEqual(sig, expected)) return null;
  if (Number(exp) < Date.now()) return null;
  return mail;
}
