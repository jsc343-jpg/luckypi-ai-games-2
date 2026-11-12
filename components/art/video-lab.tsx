"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_CLIPS_PER_BATCH,
  VIDEO_MODELS,
  XIANGYU_CLIPS,
  type VideoModelId,
} from "@/lib/art-clips";

type ClipState = { status: "idle" | "running" | "done" | "error"; url?: string; message?: string };

const ERROR_TEXT: Record<string, string> = {
  "not-admin": "請先登入管理員後台",
  "missing-key": "尚未設定 Fal 金鑰",
  "missing-blob": "尚未連接檔案儲存（Blob）",
  "limit-reached": "已達本次伺服器的購買上限",
  "bad-image": "起始圖無效，請重新生成標準圖",
  "generation-failed": "生成失敗，請再試一次",
  "bad-key": "金鑰無效，請重新確認",
  "no-balance": "Fal 餘額不足或帳戶受限",
  "rate-limited": "請求太頻繁，請稍後再試",
};

const POLL_MS = 6000;
const TOKEN_KEY = "cg_admin_token";

function adminHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = window.sessionStorage.getItem(TOKEN_KEY);
    if (token) headers["x-admin-token"] = token;
  } catch {
    // storage unavailable
  }
  return headers;
}

async function call(body: Record<string, unknown>) {
  const res = await fetch("/api/art/video", { method: "POST", headers: adminHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(ERROR_TEXT[data.error] ?? "生成失敗");
  return data as Record<string, string>;
}

const keyOf = (clipId: string, model: VideoModelId) => `${clipId}:${model}`;

export function VideoLab() {
  const [info, setInfo] = useState<{ hasKey: boolean; hasBlob: boolean } | null>(null);
  const [problem, setProblem] = useState("");
  const [keyframe, setKeyframe] = useState<string | null>(null);
  const [keyframeBusy, setKeyframeBusy] = useState(false);
  const [model, setModel] = useState<VideoModelId>("kling");
  const [selected, setSelected] = useState<string[]>(["slash-down"]);
  const [clips, setClips] = useState<Record<string, ClipState>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/art/video", { headers: adminHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setProblem(ERROR_TEXT[data.error] ?? "讀取失敗");
      return;
    }
    setInfo({ hasKey: data.hasKey, hasBlob: data.hasBlob });
    setKeyframe(data.keyframe ?? null);
    const saved: Record<string, ClipState> = {};
    for (const c of data.clips ?? []) saved[keyOf(c.clipId, c.model)] = { status: "done", url: c.url };
    setClips(saved);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const model_ = VIDEO_MODELS.find((m) => m.id === model) ?? VIDEO_MODELS[0];
  const estimate = model_.costPerClip === null ? null : model_.costPerClip * selected.length;
  const busy = keyframeBusy || Object.values(clips).some((c) => c.status === "running");

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_CLIPS_PER_BATCH) return prev;
      return [...prev, id];
    });
  }

  async function makeKeyframe() {
    setKeyframeBusy(true);
    setProblem("");
    try {
      const data = await call({ action: "keyframe" });
      setKeyframe(data.url);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "生成失敗");
    } finally {
      setKeyframeBusy(false);
    }
  }

  async function runClip(clipId: string, imageUrl: string) {
    const key = keyOf(clipId, model);
    setClips((prev) => ({ ...prev, [key]: { status: "running" } }));
    try {
      const { requestId } = await call({ action: "submit", clipId, model, imageUrl });
      while (mounted.current) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const data = await call({ action: "status", clipId, model, requestId });
        if (data.status === "COMPLETED") {
          setClips((prev) => ({ ...prev, [key]: { status: "done", url: data.url } }));
          return;
        }
      }
    } catch (error) {
      setClips((prev) => ({
        ...prev,
        [key]: { status: "error", message: error instanceof Error ? error.message : "生成失敗" },
      }));
    }
  }

  async function buySelected() {
    if (!keyframe) return;
    setProblem("");
    await Promise.all(selected.map((id) => runClip(id, keyframe)));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-balance text-2xl font-bold">項羽傳 動作影片實驗室</h1>
        <p className="text-pretty text-sm text-muted-foreground">
          先生成一張標準全身圖，再用它當起點購買動作影片。成功的影片會永久存檔，之後遊戲直接使用，不會重複扣費。
        </p>
        <Link href="/art-lab" className="w-fit text-sm underline">
          回到分件圖試作
        </Link>
        {problem ? (
          <p role="alert" className="text-pretty text-sm text-destructive">
            {problem}{" "}
            {problem.includes("管理員") ? (
              <Link href="/admin" className="underline">
                前往登入
              </Link>
            ) : null}
          </p>
        ) : null}
        {info && (!info.hasKey || !info.hasBlob) ? (
          <p role="alert" className="text-pretty text-sm text-destructive">
            {!info.hasKey ? "尚未設定 Fal 金鑰。" : ""}
            {!info.hasBlob ? "尚未連接檔案儲存（Blob），影片無法存檔。" : ""}
          </p>
        ) : null}
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">步驟 1：標準全身圖</h2>
        <div className="flex aspect-square max-w-sm items-center justify-center overflow-hidden rounded-md bg-muted">
          {keyframe ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={keyframe} alt="項羽標準全身圖" className="h-full w-full object-contain" />
          ) : (
            <span className="text-sm text-muted-foreground">
              {keyframeBusy ? "生成中..." : "尚未生成"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={makeKeyframe}
          disabled={busy}
          className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {keyframe ? "重新生成標準圖（約 $0.003）" : "生成標準圖（約 $0.003）"}
        </button>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">步驟 2：選擇要購買的動作</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="影片模型">
          {VIDEO_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={m.id === model}
              onClick={() => setModel(m.id)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                m.id === model ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-pretty text-sm text-muted-foreground">{model_.costText}</p>

        <ul className="flex flex-col gap-2">
          {XIANGYU_CLIPS.map((clip) => {
            const state = clips[keyOf(clip.id, model)] ?? { status: "idle" };
            const checked = selected.includes(clip.id);
            return (
              <li key={clip.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(clip.id)}
                    disabled={!checked && selected.length >= MAX_CLIPS_PER_BATCH}
                    className="mt-1 size-4"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{clip.label}</span>
                    <span className="text-xs text-muted-foreground">{clip.note}</span>
                  </span>
                </label>
                {state.status === "running" ? (
                  <p className="text-sm text-muted-foreground">生成中，通常需要 1 到 3 分鐘...</p>
                ) : null}
                {state.status === "error" ? (
                  <p role="alert" className="text-sm text-destructive">
                    {state.message}
                  </p>
                ) : null}
                {state.status === "done" && state.url ? (
                  <video src={state.url} controls loop muted playsInline className="w-full max-w-sm rounded-md" />
                ) : null}
              </li>
            );
          })}
        </ul>

        <p className="text-pretty text-sm">
          已選 {selected.length} / {MAX_CLIPS_PER_BATCH} 段
          {estimate !== null ? `，預估費用約 $${estimate.toFixed(2)}` : ""}
        </p>
        <button
          type="button"
          onClick={buySelected}
          disabled={busy || !keyframe || selected.length === 0}
          className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "處理中..." : "購買並存檔"}
        </button>
        {!keyframe ? <p className="text-sm text-muted-foreground">請先完成步驟 1。</p> : null}
      </section>
    </main>
  );
}
