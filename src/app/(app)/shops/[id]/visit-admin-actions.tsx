"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { softDeleteVisitAction } from "@/app/(app)/admin/actions";
import { useConfirm } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";

/** 管理者だけが他人の記録を削除するためのボタン。 */
export function VisitAdminActions({ visitId }: { visitId: string }) {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!(await confirm("この記録を削除しますか？（管理者）写真も一緒に削除されます。"))) return;
    setBusy(true);
    try {
      const res = await softDeleteVisitAction(visitId);
      if ("error" in res) toast.show(res.error, "error");
      else {
        toast.show("記録を削除しました");
        router.refresh();
      }
    } catch (e) {
      console.error("softDeleteVisit failed", e);
      toast.show("削除に失敗しました。時間をおいてもう一度お試しください", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" disabled={busy} onClick={() => void onDelete()} className="ml-auto bg-transparent p-0 text-xs text-shu">
      削除（管理者）
    </button>
  );
}
