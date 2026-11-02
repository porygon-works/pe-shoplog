"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { removeMemberAction } from "@/lib/shared-lists/actions";

/** オーナーがメンバーを外す。 */
export function RemoveMemberButton({ listId, userId, nickname }: { listId: string; userId: string; nickname: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function remove() {
    const ok = await confirm(`${nickname} さんをこのリストから外しますか？`);
    if (!ok) return;
    setBusy(true);
    try {
      const res = await removeMemberAction(listId, userId);
      if ("error" in res) toast.show(res.error, "error");
      else {
        toast.show("メンバーを外しました");
        router.refresh();
      }
    } catch {
      toast.show("外せませんでした。時間をおいてもう一度お試しください", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={`${nickname} を外す`}
      disabled={busy}
      onClick={() => void remove()}
      className="bg-transparent p-0 text-xs text-ai underline"
    >
      外す
    </button>
  );
}

/** メンバー本人が抜ける。 */
export function LeaveButton({ listId, userId }: { listId: string; userId: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function leave() {
    const ok = await confirm("このリストから抜けますか？ 追加した店はリストに残ります。");
    if (!ok) return;
    setBusy(true);
    try {
      const res = await removeMemberAction(listId, userId);
      if ("error" in res) toast.show(res.error, "error");
      else {
        toast.show("リストから抜けました");
        router.replace("/me?tab=shared");
      }
    } catch {
      toast.show("抜けられませんでした。時間をおいてもう一度お試しください", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" disabled={busy} onClick={() => void leave()} className="btn !border-shu !text-shu">
      このリストから抜ける
    </button>
  );
}
