"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createListAction } from "@/lib/lists/actions";
import { LIST_KIND_LABEL, LIST_NAME_MAX, type ListKind } from "@/lib/lists/shared";

/** マイリストタブの「＋ 新しいリスト」。作ったらそのリストのページへ移る。 */
export function NewListButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ListKind>("want");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await createListAction({ name, kind, isPublic });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push(`/lists/${res.listId}`);
    } catch {
      setError("リストを作れませんでした。時間をおいてもう一度お試しください");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start bg-transparent p-0 text-sm font-bold text-ai underline"
      >
        ＋ 新しいリスト
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-line p-3">
      <label className="flex flex-col gap-1 text-[13px] font-bold text-muted">
        リスト名
        <input
          className="input font-normal text-ink"
          value={name}
          maxLength={LIST_NAME_MAX}
          placeholder={`${LIST_NAME_MAX}文字まで`}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div role="group" aria-label="種類" className="flex gap-2">
        {(["want", "favorite"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] ${
              kind === k ? "border-ai bg-ai text-white dark:text-[#161112]" : "border-line bg-surface text-ink"
            }`}
          >
            {LIST_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-[18px] w-[18px] accent-ai"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        公開する
      </label>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-shu">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className="btn flex-1 !py-2" onClick={() => setOpen(false)} disabled={saving}>
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn-primary flex-1 !py-2"
          onClick={() => void submit()}
          disabled={saving || name.trim() === ""}
        >
          作る
        </button>
      </div>
    </div>
  );
}
