"use client";

import { useQueryStates } from "nuqs";
import { useCategories } from "@/components/categories-provider";
import { selectableOptions } from "@/lib/category-utils";
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

/**
 * 絞り込み（さがす画面）。3 列にそろえて全部見せる。登録で選ぶ区分（ジャンル・形態・喫煙・値段感・用途）をそのままドロップダウンで選べる。
 * 条件は URL クエリ（nuqs）に持つので、マップとさがすで同じ状態を共有し、サーバー側で再取得される。
 */
export function ShopFilterBar() {
  const [f, setF] = useQueryStates(shopFilterParsers, { shallow: false });
  const categories = useCategories();
  // 非表示の区分は新しく選べないが、今の絞り込みに入っているものは残す。ジャンルの「不明」は絞り込みに使わない。
  const genreOptions = selectableOptions(categories.genres, f.genre, true);
  const styleOptions = selectableOptions(categories.styles, f.styles);

  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        aria-pressed={f.want}
        onClick={() => setF({ want: f.want ? null : true })}
        className={`${chipBase} px-2 ${f.want ? chipOn : chipOff}`}
      >
        気になるだけ
      </button>
      <FilterSelect label="ジャンル" options={genreOptions} value={f.genre} onChange={(genre) => setF({ genre })} />
      <FilterSelect label="形態" options={styleOptions} value={f.styles} onChange={(styles) => setF({ styles })} />
      <FilterSelect
        label="喫煙"
        options={SMOKING_FILTER_OPTIONS}
        value={f.smoking}
        onChange={(smoking) => setF({ smoking })}
      />
      <FilterSelect label="値段感" options={PRICE_FILTER_OPTIONS} value={f.price} onChange={(price) => setF({ price })} />
      <FilterSelect label="用途" options={PURPOSE_FILTER_OPTIONS} value={f.purpose} onChange={(purpose) => setF({ purpose })} />
    </div>
  );
}
