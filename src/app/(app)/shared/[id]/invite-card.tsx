"use client";

import { useRef, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { regenerateInviteAction } from "@/lib/shared-lists/actions";

/** メンバー向けの招待リンク。コピーと、オーナーだけの作り直し。 */
export function InviteCard({ listId, initialUrl, isOwner }: { listId: string; initialUrl: string; isOwner: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.show("招待リンクをコピーしました");
    } catch {
      // クリップボードが使えない環境では、入力欄を選択して手でコピーしてもらう。
      input.current?.focus();
      input.current?.select();
      toast.show("コピーできませんでした。選択したリンクを長押しでコピーしてください", "error");
    }
  }

  async function regenerate() {
    const ok = await confirm("招待リンクを作り直しますか？ 古いリンクは使えなくなります。");
    if (!ok) return;
    setBusy(true);
    try {
      const res = await regenerateInviteAction(listId);
      if ("error" in res) toast.show(res.error, "error");
      else {
        setUrl(res.url);
        toast.show("新しい招待リンクを作りました");
      }
    } catch {
      toast.show("リンクを作り直せませんでした。時間をおいてもう一度お試しください", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface p-3">
      <div className="text-sm font-bold">メンバーを招待</div>
      <div className="flex gap-2">
        <input
          ref={input}
          className="input min-w-0 flex-[2]"
          value={url}
          readOnly
          aria-label="招待リンク"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" className="btn btn-primary !px-4 !py-2" onClick={() => void copy()}>
          コピー
        </button>
      </div>
      {isOwner && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void regenerate()}
          className="self-start bg-transparent p-0 text-xs text-ai underline"
        >
          リンクを作り直す（古いリンクは使えなくなります）
        </button>
      )}
    </div>
  );
}
