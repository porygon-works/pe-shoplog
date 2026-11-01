"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { LIST_NAME_MAX } from "@/lib/lists/shared";
import { deleteSharedListAction, updateSharedListAction } from "@/lib/shared-lists/actions";
import { SHARED_DESCRIPTION_MAX } from "@/lib/shared-lists/shared";

/** オーナーだけに出す設定メニュー。名前・説明・公開の変更と削除。 */
export function SharedOwnerMenu({
  listId,
  name,
  description,
  isPublic,
}: {
  listId: string;
  name: string;
  description: string;
  isPublic: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description);
  const [draftPublic, setDraftPublic] = useState(isPublic);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openMenu() {
    setDraftName(name);
    setDraftDescription(description);
    setDraftPublic(isPublic);
    setError(null);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await updateSharedListAction(listId, {
        name: draftName,
        description: draftDescription,
        isPublic: draftPublic,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
      toast.show("リストを更新しました");
    } catch {
      setError("保存に失敗しました。時間をおいてもう一度お試しください");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm("この共有リストを削除しますか？ メンバー全員から見えなくなります。店そのものは残ります。");
    if (!ok) return;
    setSaving(true);
    try {
      const res = await deleteSharedListAction(listId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      toast.show("リストを削除しました");
      router.push("/me?tab=shared");
    } catch {
      setError("削除に失敗しました。時間をおいてもう一度お試しください");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={openMenu} className="bg-transparent p-0 text-[13px] text-ai">
        設定
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="共有リストの設定"
            onClick={(e) => e.stopPropagation()}
            className="mx-auto flex max-h-[85dvh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-t-2xl bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom)+var(--nav-gap))] motion-safe:animate-[sheet-up_.18s_ease-out]"
          >
            <h2 className="m-0 text-base font-bold">共有リストの設定</h2>
            <label className="flex flex-col gap-1 text-[13px] font-bold text-muted">
              リスト名
              <input
                className="input font-normal text-ink"
                value={draftName}
                maxLength={LIST_NAME_MAX}
                onChange={(e) => setDraftName(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-bold text-muted">
              説明
              <input
                className="input font-normal text-ink"
                value={draftDescription}
                maxLength={SHARED_DESCRIPTION_MAX}
                onChange={(e) => setDraftDescription(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-[18px] w-[18px] accent-ai"
                checked={draftPublic}
                onChange={(e) => setDraftPublic(e.target.checked)}
              />
              公開する
              <span className="text-xs text-muted">（オフならメンバーだけが見られます）</span>
            </label>
            {error && (
              <p role="alert" className="m-0 text-[13px] text-shu">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" className="btn flex-1" onClick={() => setOpen(false)} disabled={saving}>
                閉じる
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={() => void save()}
                disabled={saving || draftName.trim() === ""}
              >
                保存
              </button>
            </div>
            <button type="button" className="btn !border-shu !text-shu" onClick={() => void remove()} disabled={saving}>
              リストを削除
            </button>
          </div>
        </div>
      )}
    </>
  );
}
