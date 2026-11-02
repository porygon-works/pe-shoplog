"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListCard } from "@/components/list-card";
import type { ListSummary, SharedListSummary } from "@/lib/lists/queries";
import { LIST_NAME_MAX } from "@/lib/lists/shared";
import { createSharedListAction } from "@/lib/shared-lists/actions";
import { SHARED_DESCRIPTION_MAX } from "@/lib/shared-lists/shared";

const pill = "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px]";

/** マイページの「共有リスト」タブ。参加中のリストと、新しく作るフォーム。 */
export function SharedListTab({ lists, mine = [] }: { lists: SharedListSummary[]; mine?: ListSummary[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await createSharedListAction({ name, description, isPublic });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push(`/shared/${res.id}`);
    } catch {
      setError("リストを作れませんでした。時間をおいてもう一度お試しください");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* 共有にしたマイリスト（ほかの人は見るだけ）。共有リストはここにまとめて見せる。 */}
      <div className="text-[13px] font-bold text-muted">自分が共有しているリスト（ほかの人は見るだけ）</div>
      {mine.length === 0 ? (
        <p className="m-0 rounded-[10px] bg-surface-2 p-4 text-center text-[13px] text-muted">
          マイリストを「共有」にすると、ここに出ます
        </p>
      ) : (
        mine.map((l) => <ListCard key={l.id} list={l} />)
      )}

      <div className="mt-2 flex items-baseline justify-between text-[13px] font-bold text-muted">
        <span>メンバーで編集する共有リスト</span>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="bg-transparent p-0 text-sm font-bold text-ai underline">
            ＋ メンバーで編集するリストを作る
          </button>
        )}
      </div>
      {open && (
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
          <label className="flex flex-col gap-1 text-[13px] font-bold text-muted">
            説明
            <input
              className="input font-normal text-ink"
              value={description}
              maxLength={SHARED_DESCRIPTION_MAX}
              placeholder={`${SHARED_DESCRIPTION_MAX}文字まで（任意）`}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-[18px] w-[18px] accent-ai"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            メンバー以外にも共有する（見るだけ）
            <span className="text-xs text-muted">（オフならメンバーだけが見られます）</span>
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
      )}
      {lists.length === 0 && !open && (
        <p className="m-0 rounded-[10px] bg-surface-2 p-4 text-center text-[13px] text-muted">
          参加中のメンバー編集リストはありません
        </p>
      )}
      {lists.map((l) => (
        <Link
          key={l.id}
          href={`/shared/${l.id}`}
          data-testid="shared-list-card"
          className="flex flex-col gap-1 rounded-[14px] border border-line bg-surface p-3 text-inherit no-underline hover:border-ai"
        >
          <div className="text-[15px] font-bold">{l.name}</div>
          {l.description && <div className="text-xs text-muted">{l.description}</div>}
          <div className="flex flex-wrap gap-1">
            <span className={`${pill} bg-ai-soft font-bold text-ai`}>メンバー{l.memberCount}人</span>
            <span className={`${pill} bg-surface-2 text-muted`}>{l.shopCount}店</span>
            <span className={`${pill} bg-surface-2 text-muted`}>{l.isPublic ? "共有" : "メンバーだけ"}</span>
          </div>
        </Link>
      ))}
    </>
  );
}
