"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorReason, getJson, postJson } from "@/lib/client-api";

interface SystemInfo {
  admins: { email: string; passwordSet: boolean; protected: boolean }[];
  me: string;
  emailConfigured: boolean;
}

const MSG: Record<string, string> = {
  invalid_code: "驗證碼不正確或已過期",
  weak_password: "密碼至少需要 8 個字元",
  too_soon: "請稍候 30 秒再重新取得驗證碼",
  exists: "此信箱已是管理員",
  invalid: "信箱格式不正確",
  protected: "此帳號無法移除",
};

interface FalKeyInfo {
  hasKey: boolean;
  source: "env" | "admin" | "none";
  last4: string | null;
  persistent: boolean;
  canStore: boolean;
}

const KEY_MSG: Record<string, string> = {
  "invalid-key": "金鑰格式不正確，請完整貼上，不要有空格",
  "no-secret": "伺服器缺少加密用的設定，無法儲存",
  "save-failed": "儲存失敗，請再試一次",
  "not-admin": "請重新登入管理員",
};

function FalKeySection() {
  const { data, mutate } = useSWR("adm-fal-key", () => getJson<FalKeyInfo>("/api/admin/fal-key"));
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const fail = (e: unknown) => toast.error(KEY_MSG[errorReason(e)] ?? "操作失敗");

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <h2 className="font-black">Fal AI 金鑰</h2>
      {data && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={data.hasKey ? "default" : "outline"}>{data.hasKey ? "已設定" : "尚未設定"}</Badge>
          {data.source === "env" && <span className="text-muted-foreground">來源：專案環境變數</span>}
          {data.source === "admin" && <span className="text-muted-foreground">來源：後台儲存（結尾 {data.last4}）</span>}
        </div>
      )}
      {data && data.source === "admin" && !data.persistent && (
        <p className="text-xs text-destructive">目前沒有連接資料庫，金鑰只存在記憶體，伺服器重啟後需要重新填寫。</p>
      )}
      {data && data.source === "env" && (
        <p className="text-xs text-muted-foreground">專案環境變數的優先權較高，後台儲存的金鑰會被它蓋過。</p>
      )}
      <Input
        type="password"
        autoComplete="off"
        placeholder="貼上 Fal 金鑰"
        aria-label="Fal 金鑰"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          disabled={saving || value.trim().length < 20}
          onClick={async () => {
            setSaving(true);
            try {
              await postJson("/api/admin/fal-key", { key: value });
              setValue("");
              await mutate();
              toast.success("金鑰已儲存");
            } catch (e) {
              fail(e);
            } finally {
              setSaving(false);
            }
          }}
        >
          儲存金鑰
        </Button>
        {data?.source === "admin" && (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await postJson("/api/admin/fal-key", { action: "clear" });
                await mutate();
                toast.success("已移除後台金鑰");
              } catch (e) {
                fail(e);
              }
            }}
          >
            移除
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">金鑰經加密後只存在伺服器，畫面上只會顯示結尾 4 碼，不會再次顯示完整內容。</p>
    </section>
  );
}

interface ResendInfo {
  hasKey: boolean;
  source: "env" | "admin" | "none";
  last4: string | null;
  from: string | null;
  fromSource: "env" | "admin" | "none";
  persistent: boolean;
  canStore: boolean;
}

const RESEND_MSG: Record<string, string> = {
  "invalid-key": "Resend 金鑰格式不正確，應以 re_ 開頭，請完整貼上，不要有空格",
  "invalid-from": "寄件者格式不正確，例如：Luckypi <no-reply@你的網域.com>",
  "no-secret": "伺服器缺少加密用的設定，無法儲存",
  "save-failed": "儲存失敗，請再試一次",
  "not-admin": "請重新登入管理員",
  "no-key": "尚未設定 Resend 金鑰",
  "send-failed": "寄送失敗，請檢查金鑰與寄件者網域",
  network: "連不上 Resend，請稍後再試",
};

function ResendKeySection() {
  const { data, mutate } = useSWR("adm-resend-key", () => getJson<ResendInfo>("/api/admin/resend-key"));
  const [key, setKey] = useState("");
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => toast.error(RESEND_MSG[errorReason(e)] ?? "操作失敗");

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <h2 className="font-black">Resend 寄信金鑰</h2>
      {data && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={data.hasKey ? "default" : "outline"}>{data.hasKey ? "已設定" : "尚未設定"}</Badge>
          {data.source === "env" && <span className="text-muted-foreground">來源：專案環境變數</span>}
          {data.source === "admin" && <span className="text-muted-foreground">來源：後台儲存（結尾 {data.last4}）</span>}
        </div>
      )}
      {data?.from && <p className="text-xs text-muted-foreground">目前寄件者：{data.from}</p>}
      {data && (data.source === "admin" || data.fromSource === "admin") && !data.persistent && (
        <p className="text-xs text-destructive">目前沒有連接資料庫，設定只存在記憶體，伺服器重啟後需要重新填寫。</p>
      )}
      {data?.source === "env" && (
        <p className="text-xs text-muted-foreground">專案環境變數的優先權較高，後台儲存的金鑰會被它蓋過。</p>
      )}
      <Input
        type="password"
        autoComplete="off"
        placeholder="貼上 Resend 金鑰（re_ 開頭）"
        aria-label="Resend 金鑰"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      <Input
        type="text"
        autoComplete="off"
        placeholder="寄件者（選填），例如 Luckypi <no-reply@你的網域.com>"
        aria-label="寄件者"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || (key.trim().length < 10 && from.trim().length < 5)}
          onClick={async () => {
            setBusy(true);
            try {
              await postJson("/api/admin/resend-key", { key, from });
              setKey("");
              setFrom("");
              await mutate();
              toast.success("已儲存");
            } catch (e) {
              fail(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          儲存
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !data?.hasKey}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await postJson<{ to?: string }>("/api/admin/resend-key", { action: "test" });
              toast.success(`測試信已寄到 ${res.to ?? "你的信箱"}`);
            } catch (e) {
              fail(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          寄測試信給我
        </Button>
        {data?.source === "admin" && (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await postJson("/api/admin/resend-key", { action: "clear" });
                await mutate();
                toast.success("已移除後台設定");
              } catch (e) {
                fail(e);
              }
            }}
          >
            移除
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        金鑰經加密後只存在伺服器，畫面上只會顯示結尾 4 碼。未驗證寄信網域時，Resend 只能寄給你的 Resend 帳號本人的信箱。
      </p>
    </section>
  );
}

export function SystemPanel() {
  const { data, mutate } = useSWR("adm-system", () => getJson<SystemInfo>("/api/admin/system"));
  const [newAdmin, setNewAdmin] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const err = (e: unknown) => toast.error(MSG[errorReason(e)] ?? "操作失敗");

  if (!data) return <p className="text-sm text-muted-foreground">載入中…</p>;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-black">變更密碼</h2>
        <p className="text-xs text-muted-foreground">需要先以 {data.me} 取得信箱驗證碼。</p>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              const res = await postJson<{ devCode?: string }>("/api/admin/request-code", {});
              setCodeSent(true);
              setDevCode(res.devCode ?? null);
              toast.success("驗證碼已寄出");
            } catch (e) {
              err(e);
            }
          }}
        >
          寄送驗證碼
        </Button>
        {devCode && (
          <p className="rounded-lg bg-secondary p-3 text-sm">
            測試環境驗證碼：<span className="font-black text-primary">{devCode}</span>
          </p>
        )}
        {codeSent && (
          <>
            <Input inputMode="numeric" maxLength={6} placeholder="驗證碼" aria-label="驗證碼" value={code} onChange={(e) => setCode(e.target.value)} />
            <Input type="password" autoComplete="new-password" placeholder="新密碼（至少 8 字元）" aria-label="新密碼" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button
              disabled={code.length < 6 || password.length < 8}
              onClick={async () => {
                try {
                  await postJson("/api/admin/set-password", { code, password });
                  toast.success("密碼已變更");
                  setCode("");
                  setPassword("");
                  setCodeSent(false);
                  setDevCode(null);
                } catch (e) {
                  err(e);
                }
              }}
            >
              確認變更
            </Button>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-black">管理員帳號</h2>
        <ul className="flex flex-col gap-2">
          {data.admins.map((a) => (
            <li key={a.email} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{a.email}</span>
              <Badge variant={a.passwordSet ? "default" : "outline"}>{a.passwordSet ? "已設密碼" : "未設密碼"}</Badge>
              {!a.protected && a.email !== data.me && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`移除 ${a.email}`}
                  onClick={async () => {
                    try {
                      await postJson("/api/admin/admin-remove", { email: a.email });
                      await mutate();
                    } catch (e) {
                      err(e);
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input type="email" placeholder="新增管理員信箱" aria-label="新增管理員信箱" value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)} />
          <Button
            disabled={!newAdmin}
            onClick={async () => {
              try {
                await postJson("/api/admin/admin-add", { email: newAdmin });
                setNewAdmin("");
                await mutate();
                toast.success("已新增，對方首次登入時需設定密碼");
              } catch (e) {
                err(e);
              }
            }}
          >
            新增
          </Button>
        </div>
      </section>

      <FalKeySection />

      <ResendKeySection />

      <section className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        <h2 className="mb-1 font-black text-foreground">系統狀態</h2>
        <p>驗證碼郵件服務：{data.emailConfigured ? "已設定" : "尚未設定（測試環境會直接顯示驗證碼）"}</p>
        <p className="mt-1">其餘系統參數與遊戲主題上架，請至「設定」分頁調整。</p>
      </section>
    </div>
  );
}
