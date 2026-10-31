"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { deleteVisitAction } from "@/lib/visits/actions";

export function VisitOwnerActions({ visitId }: { visitId: string }) {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!(await confirm("この記録を削除しますか？写真も一緒に削除されます。"))) return;
    setBusy(true);
    try {
      const res = await deleteVisitAction(visitId);
      if ("error" in res) toast.show(res.error, "error");
      else {
        toast.show("記録を削除しました");
        router.refresh();
      }
    } catch (e) {
      console.error("deleteVisit failed", e);
      toast.show("削除に失敗しました。時間をおいてもう一度お試しください", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="ml-auto flex items-center gap-3 text-xs">
      <Link href={`/visits/${visitId}/edit`} className="text-ai no-underline">
        編集
      </Link>
      <button type="button" disabled={busy} onClick={onDelete} className="bg-transparent p-0 text-xs text-shu">
        削除
      </button>
    </span>
  );
}
