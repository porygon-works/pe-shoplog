"use client";

import { usePlaceAutocomplete, type PickedPlace, type Suggestion } from "@/lib/places/use-place-autocomplete";

export { SEARCH_ERROR, type PickedPlace } from "@/lib/places/use-place-autocomplete";

export function PlaceSearch({
  onPick,
  onManual,
}: {
  onPick: (place: PickedPlace) => void;
  onManual: () => void;
}) {
  const { query, onInput, suggestions, searched, picking, pick: pickPlace } = usePlaceAutocomplete();

  const pick = async (s: Suggestion) => {
    const d = await pickPlace(s);
    if (d) onPick(d);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="q" className="text-[13px] font-bold text-muted">
          店名でさがす
        </label>
        <input
          id="q"
          className="input"
          value={query}
          onChange={(e) => onInput(e.target.value)}
          autoComplete="off"
          placeholder="例: 渋谷 居酒屋"
        />
        <span className="text-xs text-muted">
          Googleマップの店舗から選ぶと、店名と場所が自動で入ります。
        </span>
      </div>
      {suggestions.length > 0 && (
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[10px] border border-line p-0" aria-label="候補">
          {suggestions.map((s) => (
            <li key={s.placeId} className="border-b border-line last:border-b-0">
              <button
                type="button"
                disabled={picking}
                onClick={() => void pick(s)}
                className="flex w-full flex-col items-start gap-0.5 bg-surface px-3 py-2.5 text-left text-sm text-ink disabled:opacity-60"
              >
                {s.mainText}
                <small className="text-xs text-muted">{s.secondaryText}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && suggestions.length === 0 && (
        <p className="m-0 text-[13px] text-muted">候補が見つかりませんでした。</p>
      )}
      <button type="button" onClick={onManual} className="self-start bg-transparent p-0 text-[13px] text-ai underline">
        候補にない店を手入力する（地図で場所を指定）
      </button>
    </div>
  );
}
