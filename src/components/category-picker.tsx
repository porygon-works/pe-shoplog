"use client";

import { useState, useTransition } from "react";
import { quickAddCategoryAction } from "@/app/(app)/category-actions";
import { ChipGroup } from "@/components/chip-group";
import type { CategoryKind } from "@/lib/category-utils";
import type { Option } from "@/lib/options";

/**
 * ジャンル・形態を複数選ぶチップと、その場で新しい区分を足す「＋ 追加」。
 * 足した区分はすぐ選択した状態になる（一覧の再取得を待たずに選択肢にも出す）。
 */
export function CategoryPicker({
  kind,
  name,
  label,
  options,
  value,
  onChange,
}: {
  kind: CategoryKind;
  name: string;
  label: string;
  options: Option<string>[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [extra, setExtra] = useState<Option<string>[]>([]);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const all = [...options, ...extra.filter((e) => !options.some((o) => o.value === e.value))];

  const add = () => {
    const t = text.trim();
    if (!t || pending) return;
    setError(null);
    start(async () => {
      try {
        const res = await quickAddCategoryAction(kind, t);
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setExtra((x) => (x.some((e) => e.value === res.value) ? x : [...x, { value: res.value, label: res.label }]));
        if (!value.includes(res.value)) onChange([...value, res.value]);
        setText("");
        setAdding(false);
      } catch {
        setError("追加できませんでした。時間をおいてもう一度お試しください");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <ChipGroup name={name} multiple options={all} value={value} onChange={onChange} aria-label={label} />
      {adding ? (
        <div className="flex gap-2">
          <input
            aria-label={`新しい${label}の名前`}
            className="input min-w-0 flex-1"
            value={text}
            maxLength={20}
            autoFocus
            placeholder={`新しい${label}（20文字まで）`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter で店の登録フォームが送信されないよう、ここで追加する。
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" className="btn btn-primary !px-3" disabled={pending || !text.trim()} onClick={add}>
            {pending ? "追加中…" : "追加"}
          </button>
          <button
            type="button"
            className="btn !px-3"
            onClick={() => {
              setAdding(false);
              setText("");
              setError(null);
            }}
          >
            やめる
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start rounded-full border border-dashed border-line bg-surface px-3 py-1.5 text-[13px] text-ai"
        >
          ＋ {label}を追加
        </button>
      )}
      {error && (
        <p role="alert" className="m-0 text-xs text-shu">
          {error}
        </p>
      )}
    </div>
  );
}
