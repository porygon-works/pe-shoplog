"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  FILTER_KEYS,
  FILTER_LABELS,
  ShopFilterBar,
  normalizeFilterOrder,
  type FilterKey,
} from "@/components/shop-filter-sheet";

/**
 * マップの絞り込み。さがす画面と同じドロップダウンを横にスライドで並べる。
 * 並び順だけ端末ごとに変えられる（localStorage）。
 */
const KEY = "pe-map-filter-order";
const CHANGE = "pe-map-filter-order-change";
const DEFAULT_JSON = JSON.stringify(FILTER_KEYS);

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// useSyncExternalStore は同じ値なら同じ参照を返す必要があるので、文字列のまま扱う。
function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? DEFAULT_JSON;
  } catch {
    return DEFAULT_JSON;
  }
}

function parse(raw: string): FilterKey[] {
  try {
    const v = JSON.parse(raw);
    return normalizeFilterOrder(Array.isArray(v) ? v : null);
  } catch {
    return normalizeFilterOrder(null);
  }
}

function save(order: FilterKey[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    // 保存できなくても、今の画面には反映する。
  }
  window.dispatchEvent(new Event(CHANGE));
}

export function MapQuickFilters() {
  const order = parse(useSyncExternalStore(subscribe, readRaw, () => DEFAULT_JSON));
  const [editing, setEditing] = useState(false);

  return (
    <>
      <ShopFilterBar
        layout="scroll"
        order={order}
        trailing={
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-muted shadow-[0_1px_4px_rgba(0,0,0,.12)]"
          >
            並び替え
          </button>
        }
      />
      {editing && (
        <OrderEditor
          initial={order}
          onSave={(next) => {
            save(next);
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

function OrderEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: FilterKey[];
  onSave: (order: FilterKey[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FilterKey[]>(initial);
  const move = (i: number, d: -1 | 1) =>
    setDraft((cur) => {
      const j = i + d;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const arrow = "grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-surface text-ink disabled:opacity-30";

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="絞り込みの並び替え"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[85dvh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-t-2xl bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom)+var(--nav-gap))] motion-safe:animate-[sheet-up_.18s_ease-out]"
      >
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-base font-bold">マップの絞り込みの並び順</h2>
          <button
            type="button"
            onClick={() => setDraft([...FILTER_KEYS])}
            className="bg-transparent p-0 text-[13px] text-ai underline"
          >
            最初の順に戻す
          </button>
        </div>
        <p className="m-0 text-xs text-muted">よく使うものを上に。この端末にだけ保存されます。</p>
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {draft.map((k, i) => (
            <li key={k} className="flex items-center gap-2 rounded-[12px] border border-line px-3 py-2">
              <span className="w-5 text-xs text-muted">{i + 1}</span>
              <span className="flex-1 text-sm font-bold">{FILTER_LABELS[k]}</span>
              <button type="button" aria-label={`${FILTER_LABELS[k]}を上へ`} disabled={i === 0} onClick={() => move(i, -1)} className={arrow}>
                ↑
              </button>
              <button
                type="button"
                aria-label={`${FILTER_LABELS[k]}を下へ`}
                disabled={i === draft.length - 1}
                onClick={() => move(i, 1)}
                className={arrow}
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn" onClick={onClose}>
            やめる
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(draft)}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
