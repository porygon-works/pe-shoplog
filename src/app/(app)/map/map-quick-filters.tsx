"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueryStates } from "nuqs";
import { useCategories } from "@/components/categories-provider";
import { selectableOptions } from "@/lib/category-utils";
import {
  PRICE_FILTER_OPTIONS,
  PURPOSE_FILTER_OPTIONS,
  SMOKING_FILTER_OPTIONS,
  shopFilterParsers,
} from "@/lib/filters/shop-filters";

/**
 * マップのワンタップ絞り込み。どのボタンを出すかは端末ごとに選べる（localStorage）。
 * ボタンの値は「want」か「区分:値」（例: smoking:smoking_ok）。同じ区分のボタンは「どれか」、
 * 違う区分は「すべて」で絞り込む（URL の絞り込みと同じ）。
 */
type Field = "genre" | "styles" | "smoking" | "price" | "purpose";
type Group = { field: Field; label: string; options: { value: string; label: string }[] };

const KEY = "pe-map-quick-filters";
const CHANGE = "pe-map-quick-filters-change";
const DEFAULT = ["want", "smoking:smoking_ok", "smoking:no_smoking", "purpose:celebration", "price:under_3000"];
const DEFAULT_JSON = JSON.stringify(DEFAULT);

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

function parse(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function save(keys: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys));
  } catch {
    // 保存できなくても、今の画面には反映する。
  }
  window.dispatchEvent(new Event(CHANGE));
}

const chip = "whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] shadow-[0_1px_4px_rgba(0,0,0,.1)]";
const chipOn = "border-ai bg-ai text-white dark:text-[#161112]";
const chipOff = "border-line bg-surface text-ink";

export function MapQuickFilters() {
  const [f, setF] = useQueryStates(shopFilterParsers, { shallow: false });
  const categories = useCategories();
  const keys = parse(useSyncExternalStore(subscribe, readRaw, () => DEFAULT_JSON));
  const [editing, setEditing] = useState(false);

  const groups: Group[] = [
    { field: "genre", label: "ジャンル", options: selectableOptions(categories.genres, f.genre, true) },
    { field: "styles", label: "形態", options: selectableOptions(categories.styles, f.styles) },
    { field: "smoking", label: "喫煙", options: [...SMOKING_FILTER_OPTIONS] },
    { field: "price", label: "値段感", options: [...PRICE_FILTER_OPTIONS] },
    { field: "purpose", label: "用途", options: [...PURPOSE_FILTER_OPTIONS] },
  ];
  const labelOf = (key: string): string | null => {
    if (key === "want") return "気になるだけ";
    const [field, value] = key.split(":");
    const g = groups.find((x) => x.field === field);
    return g?.options.find((o) => o.value === value)?.label ?? null;
  };

  const isOn = (key: string) => {
    if (key === "want") return f.want;
    const [field, value] = key.split(":") as [Field, string];
    return f[field].includes(value);
  };
  const toggle = (key: string) => {
    if (key === "want") return void setF({ want: f.want ? null : true });
    const [field, value] = key.split(":") as [Field, string];
    const cur = f[field];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    void setF({ [field]: next.length ? next : null });
  };

  // 区分が非表示・削除されたボタンは出さない。
  const shown = keys.filter((k) => labelOf(k) !== null);

  return (
    <>
      <div className="flex flex-wrap gap-1.5" aria-label="ワンタップ絞り込み" role="group">
        {shown.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={isOn(k)}
            onClick={() => toggle(k)}
            className={`${chip} ${isOn(k) ? chipOn : chipOff}`}
          >
            {labelOf(k)}
          </button>
        ))}
        <button type="button" onClick={() => setEditing(true)} className={`${chip} ${chipOff} text-muted`}>
          ＋ 編集
        </button>
      </div>
      {editing && (
        <QuickFilterEditor
          groups={groups}
          selected={keys}
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

function QuickFilterEditor({
  groups,
  selected,
  onSave,
  onClose,
}: {
  groups: Group[];
  selected: string[];
  onSave: (keys: string[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(selected);
  const toggle = (k: string) => setDraft((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pill = (k: string, label: string) => (
    <button
      key={k}
      type="button"
      aria-pressed={draft.includes(k)}
      onClick={() => toggle(k)}
      className={`rounded-full border px-3 py-1.5 text-[13px] ${draft.includes(k) ? chipOn : chipOff}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ワンタップ絞り込みの編集"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[85dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-2xl bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom)+var(--nav-gap))] motion-safe:animate-[sheet-up_.18s_ease-out]"
      >
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-base font-bold">マップに出すボタン</h2>
          <button type="button" onClick={() => setDraft(DEFAULT)} className="bg-transparent p-0 text-[13px] text-ai underline">
            最初の状態に戻す
          </button>
        </div>
        <p className="m-0 text-xs text-muted">選んだ順にマップの上に並びます。この端末にだけ保存されます。</p>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-muted">記録</span>
          <div className="flex flex-wrap gap-1.5">{pill("want", "気になるだけ")}</div>
        </div>
        {groups.map((g) => (
          <div key={g.field} className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold text-muted">{g.label}</span>
            <div className="flex flex-wrap gap-1.5">{g.options.map((o) => pill(`${g.field}:${o.value}`, o.label))}</div>
          </div>
        ))}
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
