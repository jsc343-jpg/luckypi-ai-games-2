import { NextResponse } from "next/server";
import { adminEmailFromRequest } from "@/lib/server/admin-session";
import { clearResend, getResendFrom, getResendKey, resendStatus, saveResend } from "@/lib/server/resend-key";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

const FROM_PATTERN = /^[^<>\r\n]{1,60}<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$|^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

export async function GET(req: Request) {
  if (!adminEmailFromRequest(req)) return fail("not-admin", 401);
  return NextResponse.json(await resendStatus());
}

export async function POST(req: Request) {
  const admin = adminEmailFromRequest(req);
  if (!admin) return fail("not-admin", 401);
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    key?: string;
    from?: string;
  } | null;

  if (body?.action === "clear") {
    await clearResend();
    return NextResponse.json(await resendStatus());
  }

  if (body?.action === "test") {
    const key = await getResendKey();
    if (!key) return fail("no-key", 400);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: await getResendFrom(),
          to: [admin],
          subject: "Luckypi AI Leisure Casino (II) test mail",
          text: "This is a test mail. Your mail service is working.",
        }),
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 200);
        return NextResponse.json({ error: "send-failed", detail }, { status: 502 });
      }
      return NextResponse.json({ ok: true, to: admin });
    } catch {
      return fail("network", 502);
    }
  }

  const key = body?.key?.trim() ?? "";
  const from = body?.from?.trim() ?? "";
  if (!key && !from) return fail("invalid-key");
  if (key && (!/^re_[A-Za-z0-9_]{10,}$/.test(key))) return fail("invalid-key");
  if (from && !FROM_PATTERN.test(from)) return fail("invalid-from");

  const result = await saveResend({ key: key || undefined, from: from || undefined });
  if (result === "no-secret") return fail("no-secret", 503);
  if (result === "failed") return fail("save-failed", 500);
  return NextResponse.json(await resendStatus());
}
