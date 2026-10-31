"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { joinSharedListAction } from "@/lib/shared-lists/actions";

export function JoinButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await joinSharedListAction(token);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push(`/shared/${res.id}`);
    } catch {
      setError("参加できませんでした。時間をおいてもう一度お試しください");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void join()}>
        参加する
      </button>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-shu">
          {error}
        </p>
      )}
    </>
  );
}
