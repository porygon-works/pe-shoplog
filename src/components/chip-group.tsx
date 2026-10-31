"use client";

import type { Option } from "@/lib/options";

type Common<V extends string> = {
  options: readonly Option<V>[];
  /** フォーム送信用の hidden input の name。 */
  name: string;
  /** 横一列にスクロールさせる（地図上のフィルタ行など）。 */
  scroll?: boolean;
  "aria-label"?: string;
};

type Single<V extends string> = Common<V> & {
  multiple?: false;
  value: V;
  onChange: (value: V) => void;
};

type Multiple<V extends string> = Common<V> & {
  multiple: true;
  value: readonly V[];
  onChange: (value: V[]) => void;
};

export type ChipGroupProps<V extends string> = Single<V> | Multiple<V>;

/**
 * 選択肢をチップで選ばせる。単一選択では「不明」のチップを出さず、
 * 選択中のチップをもう一度押すと 'unknown' に戻す（未選択＝不明）。
 */
export function ChipGroup<V extends string>(props: ChipGroupProps<V>) {
  const { options, name, scroll } = props;

  const isOn = (v: V) => (props.multiple ? props.value.includes(v) : props.value === v);
  const toggle = (v: V) => {
    if (props.multiple) {
      props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else {
      props.onChange(props.value === v ? ("unknown" as V) : v);
    }
  };

  const visible = props.multiple ? options : options.filter((o) => o.value !== "unknown");
  const hiddenValues: string[] = props.multiple ? [...props.value] : [props.value];

  return (
    <div
      role="group"
      aria-label={props["aria-label"]}
      className={`flex gap-2 ${scroll ? "flex-nowrap overflow-x-auto pb-0.5 [scrollbar-width:none]" : "flex-wrap"}`}
    >
      {visible.map((o) => {
        const on = isOn(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] ${
              on
                ? "border-ai bg-ai text-white dark:text-[#0f131b]"
                : "border-line bg-surface text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
      {hiddenValues.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </div>
  );
}
