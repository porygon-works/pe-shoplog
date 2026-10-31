"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import {
  createListAction,
  listPickerDataAction,
  setListItemAction,
} from "@/lib/lists/actions";
import { LIST_KIND_LABEL, LIST_NAME_MAX, type ListKind, type PickerList, sortPickerLists } from "@/lib/lists/shared";

export type ListPickerMode = ListKind | "any";

function titleOf(mode: ListPickerMode): string {
  return mode === "any" ? "リストに追加" : `「${LIST_KIND_LABEL[mode]}」のリストに追加`;
}

/**
 * 店をマイリストに入れる・外すシート。チェックを変えるとその場で保存する。
 * 開いた時点ではチェックを変えず、すでに入っているリストにチェックが付いた状態で開く。
 * mode が 'any' のときは種類を問わず自分のリストを出す（共有リストの区画は Task 13 で追加する）。
 */
export function ListPickerSheet({
  shopId,
  mode,
  onClose,
}: {
  shopId: string;
  mode: ListPickerMode;
  /** 閉じるとき（完了・背景タップ・Esc）。親は表示の更新を行う。 */
  onClose: () => void;
}) {
  const toast = useToast();
  const [lists, setLists] = useState<PickerList[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    listPickerDataAction(shopId, mode === "any" ? undefined : mode)
      .then((res) => {
        if (!alive) return;
        if ("error" in res) setLoadError(res.error);
        else setLists(sortPickerLists(res.lists));
      })
      .catch(() => alive && setLoadError("リストを読み込めませんでした。時間をおいてもう一度お試しください"));
    return () => {
      alive = false;
    };
  }, [shopId, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = (id: string, included: boolean) =>
    setLists((prev) => prev && prev.map((l) => (l.id === id ? { ...l, included } : l)));
  const setBusyFor = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  async function toggle(list: PickerList, included: boolean) {
    patch(list.id, included);
    setBusyFor(list.id, true);
    try {
      const res = await setListItemAction(list.id, shopId, included);
      if ("error" in res) {
        patch(list.id, !included);
        toast.show(res.error, "error");
      }
    } catch {
      patch(list.id, !included);
      toast.show("保存に失敗しました。時間をおいてもう一度お試しください", "error");
    } finally {
      setBusyFor(list.id, false);
    }
  }

  async function onCreated(list: PickerList) {
    setLists((prev) => sortPickerLists([...(prev ?? []), list]));
    setCreating(false);
    // 作ったリストにはそのまま今の店を入れる。
    setBusyFor(list.id, true);
    try {
      const res = await setListItemAction(list.id, shopId, true);
      if ("error" in res) toast.show(res.error, "error");
      else patch(list.id, true);
    } catch {
      toast.show("リストに店を追加できませんでした。もう一度お試しください", "error");
    } finally {
      setBusyFor(list.id, false);
    }
  }

  const title = titleOf(mode);
  // 区画の配列にしてあるので、共有リストの区画は後から追加できる。
  const sections: { key: string; heading?: string; body: React.ReactNode }[] = [
    {
      key: "personal",
      body: (
        <div className="flex flex-col">
          {lists?.map((l) => (
            <label key={l.id} className="flex items-center gap-2.5 border-b border-line py-2.5 text-sm">
              <input
                type="checkbox"
                className="h-[18px] w-[18px] accent-ai"
                checked={l.included}
                disabled={busy.has(l.id)}
                onChange={(e) => void toggle(l, e.target.checked)}
              />
              <span className="min-w-0 flex-1 break-words">
                {l.name}
                {l.isDefault && <span className="text-xs text-muted">（既定）</span>}
                {mode === "any" && <span className="ml-1.5 text-xs text-muted">{LIST_KIND_LABEL[l.kind]}</span>}
              </span>
              <span className="text-xs text-muted">{l.isPublic ? "公開" : "非公開"}</span>
            </label>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[85dvh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-t-2xl bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom))] motion-safe:animate-[sheet-up_.18s_ease-out]"
      >
        <h2 className="m-0 text-base font-bold">{title}</h2>
        {loadError ? (
          <p role="alert" className="m-0 rounded-[10px] bg-shu-soft p-3 text-[13px] text-shu">
            {loadError}
          </p>
        ) : lists === null ? (
          <p className="m-0 text-[13px] text-muted">読み込み中…</p>
        ) : (
          sections.map((s) => (
            <section key={s.key}>
              {s.heading && <p className="m-0 mb-1 text-[13px] font-bold text-muted">{s.heading}</p>}
              {s.body}
            </section>
          ))
        )}
        {lists !== null &&
          (creating ? (
            <NewListForm
              fixedKind={mode === "any" ? null : mode}
              onCancel={() => setCreating(false)}
              onCreated={(l) => void onCreated(l)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="self-start bg-transparent p-0 text-sm font-bold text-ai underline"
            >
              ＋ 新しいリストを作る
            </button>
          ))}
        <button type="button" className="btn btn-primary" onClick={onClose}>
          完了
        </button>
      </div>
    </div>
  );
}

function NewListForm({
  fixedKind,
  onCancel,
  onCreated,
}: {
  fixedKind: ListKind | null;
  onCancel: () => void;
  onCreated: (list: PickerList) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ListKind>(fixedKind ?? "want");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const res = await createListAction({ name, kind, isPublic });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onCreated({
        id: res.listId,
        name: name.trim(),
        kind,
        isPublic,
        isDefault: false,
        included: false,
        createdAt: new Date().toISOString(),
      });
    } catch {
      toast.show("リストを作れませんでした。時間をおいてもう一度お試しください", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[10px] bg-surface-2 p-3">
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
      {fixedKind === null && (
        <div role="group" aria-label="種類" className="flex gap-2">
          {(["want", "favorite"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] ${
                kind === k ? "border-ai bg-ai text-white dark:text-[#0f131b]" : "border-line bg-surface text-ink"
              }`}
            >
              {LIST_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-[18px] w-[18px] accent-ai"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        公開する
        <span className="text-xs text-muted">（だれでも見られます）</span>
      </label>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-shu">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className="btn flex-1 !py-2" onClick={onCancel} disabled={saving}>
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
