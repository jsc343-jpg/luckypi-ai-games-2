"use client";

import { useEffect, useState } from "react";
import { ART_CHARACTERS } from "@/lib/art-parts";

type PartState = { status: "idle" | "loading" | "done" | "error"; url?: string; message?: string };

const ERROR_TEXT: Record<string, string> = {
  "missing-key": "尚未設定 Fal 金鑰",
  "not-admin": "請先登入管理員後台再生成",
  "limit-reached": "已達本次生成上限",
  "generation-failed": "生成失敗，請再試一次",
  timeout: "Fal 回應太久，請稍後再試",
  "bad-key": "金鑰無效，請重新確認",
  "no-balance": "Fal 餘額不足或帳戶受限",
  "rate-limited": "請求太頻繁，請稍後再試",
};

const CLIENT_TIMEOUT_MS = 115_000;

function adminHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = window.sessionStorage.getItem("cg_admin_token");
    if (token) headers["x-admin-token"] = token;
  } catch {
    // storage unavailable; the cookie path still applies
  }
  return headers;
}

export function ArtLab() {
  const [characterId, setCharacterId] = useState(ART_CHARACTERS[0].id);
  const [parts, setParts] = useState<Record<string, PartState>>({});
  const character = ART_CHARACTERS.find((c) => c.id === characterId) ?? ART_CHARACTERS[0];
  const [checkText, setCheckText] = useState("");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const anyLoading = Object.values(parts).some((p) => p.status === "loading");
    if (!anyLoading) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => {
      clearInterval(id);
      setElapsed(0);
    };
  }, [parts]);

  async function checkConnection() {
    setCheckText("檢查中...");
    try {
      const res = await fetch("/api/art/generate");
      const data = await res.json();
      setCheckText(
        data.hasKey
          ? `連線正常，已讀到金鑰（長度 ${data.keyLength}，${data.keyHasColon ? "含冒號" : "不含冒號"}），本次已生成 ${data.used} 次`
          : "連線正常，但伺服器讀不到金鑰",
      );
    } catch {
      setCheckText("連不到伺服器，請重新整理頁面");
    }
  }

  async function generate(partId: string, charId = characterId) {
    const key = `${charId}:${partId}`;
    setParts((prev) => ({ ...prev, [key]: { status: "loading" } }));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch("/api/art/generate", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ characterId: charId, partId }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setParts((prev) => ({
          ...prev,
          [key]: { status: "error", message: ERROR_TEXT[data.error] ?? "生成失敗" },
        }));
        return;
      }
      setParts((prev) => ({ ...prev, [key]: { status: "done", url: data.imageUrl } }));
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      setParts((prev) => ({
        ...prev,
        [key]: { status: "error", message: aborted ? "等待逾時，請再試一次" : "網路錯誤" },
      }));
    } finally {
      clearTimeout(timer);
    }
  }

  async function generateAll() {
    for (const part of character.parts) {
      await generate(part.id, character.id);
    }
  }

  const busy = Object.values(parts).some((p) => p.status === "loading");

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-balance text-2xl font-bold">角色分件圖試作（電影感）</h1>
        <p className="text-pretty text-sm text-muted-foreground">
          每個部位會先生成圖片，再自動去背。確認畫風後，這些圖會拿去做骨架動畫。
        </p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="選擇角色">
          {ART_CHARACTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === characterId}
              onClick={() => setCharacterId(c.id)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                c.id === characterId ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={generateAll}
          disabled={busy}
          className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? `生成中...已等待 ${elapsed} 秒` : "一次生成全部（5 張）"}
        </button>
        <button
          type="button"
          onClick={checkConnection}
          className="w-fit rounded-md border border-border px-4 py-2 text-sm"
        >
          檢查金鑰與連線
        </button>
        {checkText ? <p className="text-pretty text-sm">{checkText}</p> : null}
        <a href="/art-lab/video" className="w-fit text-sm underline">
          前往動作影片實驗室（管理員）
        </a>
      </header>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {character.parts.map((part) => {
          const state = parts[`${character.id}:${part.id}`] ?? { status: "idle" };
          return (
            <li key={part.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-muted">
                {state.status === "done" && state.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={state.url} alt={`${character.label}${part.label}`} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {state.status === "loading" ? "生成中..." : state.status === "error" ? state.message : "尚未生成"}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{part.label}</span>
                <button
                  type="button"
                  onClick={() => generate(part.id)}
                  disabled={state.status === "loading"}
                  className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50"
                >
                  {state.status === "done" ? "重畫" : "生成"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
