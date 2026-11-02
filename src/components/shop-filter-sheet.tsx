"use client";

import { useQueryStates } from "nuqs";
import { useCategories } from "@/components/categories-provider";
import { selectableOptions } from "@/lib/category-utils";
import { TIME_SLOTS } from "@/lib/options";
import {
  PRICE_FILTER_OPTIONS,
  PURPOSE_FILTER_OPTIONS,
  SMOKING_FILTER_OPTIONS,
  shopFilterParsers,
} from "@/lib/filters/shop-filters";

const chipBase = "whitespace-nowrap rounded-full border py-1.5 text-[13px]";
const chipOn = "border-ai bg-ai text-white dark:text-[#161112]";
const chipOff = "border-line bg-surface text-ink";

type Opt = { value: string; label: string };

/**
 * 登録のときと同じ選択肢のドロップダウン（1 つ選ぶ）。URL に複数入っているときは「n件」と出して、選び直せるようにする。
 */
function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Opt[];
  value: string[];
  onChange: (v: string[] | null) => void;
}) {
  const current = value.length === 1 ? value[0] : value.length > 1 ? "__multi" : "";
  const on = value.length > 0;
  return (
    <span className="relative min-w-0">
      <select
        aria-label={label}
        value={current}
        onChange={(e) => onChange(e.target.value ? [e.target.value] : null)}
        className={`${chipBase} ${on ? chipOn : chipOff} w-full appearance-none truncate pl-3 pr-7`}
      >
        <option value="">{label}</option>
        {value.length > 1 && (
          <option value="__multi" disabled>
            {label} {value.length}件
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] ${on ? "text-white dark:text-[#161112]" : "text-muted"}`}
      >
        ▾
      </span>
    </span>
  );
}

/** 絞り込みの項目。並び順はこの順が既定（マップでは並び替えできる）。 */
export const FILTER_KEYS = ["smoking", "price", "purpose", "genre", "styles", "want", "time"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export const FILTER_LABELS: Record<FilterKey, string> = {
  smoking: "喫煙",
  price: "値段感",
  purpose: "用途",
  genre: "ジャンル",
  styles: "形態",
  want: "気になる",
  time: "時間帯",
};

/** 保存された並び順を検証し、足りない項目は既定の順で後ろに足す。 */
export function normalizeFilterOrder(order: readonly string[] | null | undefined): FilterKey[] {
  const valid = (order ?? []).filter((k): k is FilterKey => (FILTER_KEYS as readonly string[]).includes(k));
  const uniq = [...new Set(valid)];
  return [...uniq, ...FILTER_KEYS.filter((k) => !uniq.includes(k))];
}

/**
 * 絞り込み。登録で選ぶ区分（喫煙・値段感・用途・ジャンル・形態）と「気になる」をドロップダウンで選ぶ。
 * layout="grid" はさがす画面用（3 列で全部見せる）、"scroll" はマップ用（横にスライド）。
 * 条件は URL クエリ（nuqs）に持つので、マップとさがすで同じ状態を共有し、サーバー側で再取得される。
 */
export function ShopFilterBar({
  layout = "grid",
  order = FILTER_KEYS,
  trailing,
}: {
  layout?: "grid" | "scroll";
  order?: readonly FilterKey[];
  trailing?: React.ReactNode;
}) {
  const [f, setF] = useQueryStates(shopFilterParsers, { shallow: false });
  const categories = useCategories();
  // 非表示の区分は新しく選べないが、今の絞り込みに入っているものは残す。ジャンルの「不明」は絞り込みに使わない。
  const genreOptions = selectableOptions(categories.genres, f.genre, true);
  const styleOptions = selectableOptions(categories.styles, f.styles);

  const item = (k: FilterKey) => {
    const label = FILTER_LABELS[k];
    switch (k) {
      case "want":
        return (
          <FilterSelect
            key={k}
            label={label}
            options={[{ value: "only", label: "気になる店だけ" }]}
            value={f.want ? ["only"] : []}
            onChange={(v) => setF({ want: v ? true : null })}
          />
        );
      case "time":
        return <FilterSelect key={k} label={label} options={TIME_SLOTS} value={f.time} onChange={(time) => setF({ time })} />;
      case "genre":
        return <FilterSelect key={k} label={label} options={genreOptions} value={f.genre} onChange={(genre) => setF({ genre })} />;
      case "styles":
        return <FilterSelect key={k} label={label} options={styleOptions} value={f.styles} onChange={(styles) => setF({ styles })} />;
      case "smoking":
        return (
          <FilterSelect key={k} label={label} options={SMOKING_FILTER_OPTIONS} value={f.smoking} onChange={(smoking) => setF({ smoking })} />
        );
      case "price":
        return <FilterSelect key={k} label={label} options={PRICE_FILTER_OPTIONS} value={f.price} onChange={(price) => setF({ price })} />;
      case "purpose":
        return (
          <FilterSelect key={k} label={label} options={PURPOSE_FILTER_OPTIONS} value={f.purpose} onChange={(purpose) => setF({ purpose })} />
        );
    }
  };

  return layout === "grid" ? (
    <div className="grid grid-cols-3 gap-2">
      {order.map(item)}
      {trailing}
    </div>
  ) : (
    <div className="-mx-2.5 flex flex-nowrap gap-1.5 overflow-x-auto px-2.5 pb-1 [scrollbar-width:none] [&>*]:flex-none [&_select]:w-[6.25rem] [&_select]:shadow-[0_1px_4px_rgba(0,0,0,.12)]">
      {order.map(item)}
      {trailing}
    </div>
  );
}
