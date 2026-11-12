"use client";

import Link from "next/link";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Dashboard } from "@/components/admin/dashboard";
import { LoginPanel } from "@/components/admin/login-panel";
import { useGame } from "@/contexts/game-context";
import { getJson } from "@/lib/client-api";

export default function AdminPage() {
  const { adminCandidate, tr } = useGame();
  const { data, isLoading, mutate } = useSWR(
    "adm-me",
    () => getJson<{ email: string }>("/api/admin/me").catch(() => null),
    { revalidateOnFocus: false },
  );

  if (isLoading || adminCandidate === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  // The entrance is only offered to players whose email is an admin email.
  // Real access still requires the verification below.
  if (!adminCandidate && !data) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">{tr("找不到此頁面", "Page not found")}</p>
        <Button asChild variant="secondary">
          <Link href="/">{tr("返回首頁", "Home")}</Link>
        </Button>
      </main>
    );
  }

  if (!data) return <LoginPanel onDone={() => void mutate()} />;
  return <Dashboard email={data.email} onLogout={() => void mutate(null, { revalidate: false })} />;
}
