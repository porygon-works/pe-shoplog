"use client";

import { usePlaceAutocomplete, type PickedPlace, type Suggestion } from "@/lib/places/use-place-autocomplete";

/** 地図の上の検索欄。Google の店舗から探し、選ぶと地図をその店へ動かす。 */
export function MapPlaceSearch({
  getBias,
  onPick,
}: {
  getBias: () => { lat: number; lng: number } | null;
  onPick: (place: PickedPlace) => void;
}) {
  const { query, onInput, suggestions, searched, picking, pick, reset } = usePlaceAutocomplete(getBias);

  const choose = async (s: Suggestion) => {
    const d = await pick(s);
    if (!d) return;
    reset();
    onPick(d);
  };

  const open = query.trim() !== "";

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-surface shadow-[0_2px_10px_rgba(0,0,0,.12)]">
      <div className="flex items-center">
        <input
          type="search"
          aria-label="お店をさがす"
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted"
          value={query}
          onChange={(e) => onInput(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="お店をさがす（例: 池袋 焼き鳥）"
        />
        {open && (
          <button type="button" onClick={reset} className="bg-transparent px-3 py-2 text-xs text-muted">
            クリア
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul
          className="m-0 flex max-h-[45vh] list-none flex-col overflow-y-auto border-t border-line p-0"
          aria-label="候補"
        >
          {suggestions.map((s) => (
            <li key={s.placeId} className="border-b border-line last:border-b-0">
              <button
                type="button"
                disabled={picking}
                onClick={() => void choose(s)}
                className="flex w-full flex-col items-start gap-0.5 bg-surface px-3 py-2.5 text-left text-sm text-ink disabled:opacity-60"
              >
                {s.mainText}
                <small className="text-xs text-muted">{s.secondaryText}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && searched && suggestions.length === 0 && (
        <p className="m-0 border-t border-line px-3 py-2.5 text-[13px] text-muted">候補が見つかりませんでした。</p>
      )}
    </div>
  );
}
