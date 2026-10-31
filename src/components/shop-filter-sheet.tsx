"use client";

import { useEffect, useState } from "react";
import { useQueryStates } from "nuqs";
import { ChipGroup } from "@/components/chip-group";
import {
  CELEBRATION,
  GENRE_FILTER_OPTIONS,
  PRICE_FILTER_OPTIONS,
  PURPOSE_FILTER_OPTIONS,
  SMOKING_FILTER_OPTIONS,
  STYLE_FILTER_OPTIONS,
  SMOKABLE,
  hasAll,
  shopFilterParsers,
  toggleValues,
} from "@/lib/filters/shop-filters";

type Draft = {
  genre: string[];
  styles: string[];
  smoking: string[];
  price: string[];
  purpose: string[];
  want: boolean;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-muted">{label}</span>
      {children}
    </div>
  );
}

function FilterSheet({
  initial,
  onApply,
  onClose,
}: {
  initial: Draft;
  onApply: (d: Draft) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="絞り込み"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-surface p-4 motion-safe:animate-[sheet-up_.18s_ease-out]"
      >
        <h2 className="m-0 text-base font-bold">絞り込み</h2>
        <Field label="ジャンル">
          <ChipGroup multiple name="genre" aria-label="ジャンル" options={GENRE_FILTER_OPTIONS} value={d.genre} onChange={(genre) => setD({ ...d, genre })} />
        </Field>
        <Field label="店の形態">
          <ChipGroup multiple name="styles" aria-label="店の形態" options={STYLE_FILTER_OPTIONS} value={d.styles} onChange={(styles) => setD({ ...d, styles })} />
        </Field>
        <Field label="喫煙">
          <ChipGroup multiple name="smoking" aria-label="喫煙" options={SMOKING_FILTER_OPTIONS} value={d.smoking} onChange={(smoking) => setD({ ...d, smoking })} />
        </Field>
        <Field label="値段感">
          <ChipGroup multiple name="price" aria-label="値段感" options={PRICE_FILTER_OPTIONS} value={d.price} onChange={(price) => setD({ ...d, price })} />
        </Field>
        <Field label="用途">
          <ChipGroup multiple name="purpose" aria-label="用途" options={PURPOSE_FILTER_OPTIONS} value={d.purpose} onChange={(purpose) => setD({ ...d, purpose })} />
        </Field>
        <button
          type="button"
          aria-pressed={d.want}
          onClick={() => setD({ ...d, want: !d.want })}
          className={`self-start whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] ${
            d.want ? "border-ai bg-ai text-white dark:text-[#0f131b]" : "border-line bg-surface text-ink"
          }`}
        >
          気になるだけ
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn flex-1"
            onClick={() => setD({ genre: [], styles: [], smoking: [], price: [], purpose: [], want: false })}
          >
            クリア
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={() => onApply(d)}>
            適用
          </button>
        </div>
      </div>
    </div>
  );
}

const chipBase = "whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px]";
const chipOn = "border-ai bg-ai text-white dark:text-[#0f131b]";
const chipOff = "border-line bg-surface text-ink";

/**
 * クイックチップ + 絞り込みシートを開くチップの行。条件は URL クエリ（nuqs）に持つので、
 * マップとさがすで同じ状態を共有し、サーバー側で再取得される。
 */
export function ShopFilterBar() {
  const [f, setF] = useQueryStates(shopFilterParsers, { shallow: false });
  const [open, setOpen] = useState(false);

  const dropdown = (label: string, count: number) => (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => setOpen(true)}
      className={`${chipBase} ${count > 0 ? chipOn : chipOff}`}
    >
      {label}
      {count > 0 ? ` ${count}` : ""} ▾
    </button>
  );

  return (
    <>
      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        <button
          type="button"
          aria-pressed={hasAll(f.smoking, SMOKABLE)}
          onClick={() => setF({ smoking: nonEmpty(toggleValues(f.smoking, SMOKABLE)) })}
          className={`${chipBase} ${hasAll(f.smoking, SMOKABLE) ? chipOn : chipOff}`}
        >
          吸える
        </button>
        <button
          type="button"
          aria-pressed={hasAll(f.purpose, CELEBRATION)}
          onClick={() => setF({ purpose: nonEmpty(toggleValues(f.purpose, CELEBRATION)) })}
          className={`${chipBase} ${hasAll(f.purpose, CELEBRATION) ? chipOn : chipOff}`}
        >
          打ち上げ実績
        </button>
        <button
          type="button"
          aria-pressed={f.want}
          onClick={() => setF({ want: f.want ? null : true })}
          className={`${chipBase} ${f.want ? chipOn : chipOff}`}
        >
          気になるだけ
        </button>
        {dropdown("ジャンル", f.genre.length)}
        {dropdown("値段感", f.price.length)}
        {dropdown("用途", f.purpose.length)}
      </div>
      {open && (
        <FilterSheet
          initial={{ genre: f.genre, styles: f.styles, smoking: f.smoking, price: f.price, purpose: f.purpose, want: f.want }}
          onClose={() => setOpen(false)}
          onApply={(d) => {
            void setF({
              genre: nonEmpty(d.genre),
              styles: nonEmpty(d.styles),
              smoking: nonEmpty(d.smoking),
              price: nonEmpty(d.price),
              purpose: nonEmpty(d.purpose),
              want: d.want ? true : null,
            });
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/** 空配列は null にして URL から消す。 */
function nonEmpty(a: string[]): string[] | null {
  return a.length ? a : null;
}
