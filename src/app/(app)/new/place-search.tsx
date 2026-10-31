"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";

export type PickedPlace = { placeId: string; name: string; lat: number; lng: number };
type Suggestion = { placeId: string; mainText: string; secondaryText: string };

export const SEARCH_ERROR = "お店の検索に失敗しました。時間をおいてもう一度お試しください";
const DEBOUNCE_MS = 300;

export function PlaceSearch({
  onPick,
  onManual,
}: {
  onPick: (place: PickedPlace) => void;
  onManual: () => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searched, setSearched] = useState(false);
  const [picking, setPicking] = useState(false);
  // Places の課金セッション。検索を始めるときに作り、details を取るまで使い回す。
  const session = useRef<string | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const search = useCallback(
    async (q: string, token: string, mine: number) => {
      try {
        const res = await fetch(
          `/api/places/autocomplete?q=${encodeURIComponent(q)}&session=${encodeURIComponent(token)}`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { suggestions: Suggestion[] };
        if (mine !== seq.current) return; // 古い応答は捨てる
        setSuggestions(data.suggestions);
        setSearched(true);
      } catch {
        if (mine !== seq.current) return;
        setSuggestions([]);
        setSearched(false);
        toast.show(SEARCH_ERROR, "error");
      }
    },
    [toast],
  );

  const onInput = (value: string) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    const mine = ++seq.current;
    if (!q) {
      setSuggestions([]);
      setSearched(false);
      return;
    }
    if (!session.current) session.current = crypto.randomUUID();
    const token = session.current;
    timer.current = setTimeout(() => void search(q, token, mine), DEBOUNCE_MS);
  };

  const pick = async (s: Suggestion) => {
    if (picking) return;
    setPicking(true);
    seq.current++; // 選択後に遅れて届く検索結果は無視する
    if (timer.current) clearTimeout(timer.current);
    try {
      const params = new URLSearchParams({ id: s.placeId });
      if (session.current) params.set("session", session.current);
      const res = await fetch(`/api/places/details?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as PickedPlace;
      session.current = null; // 選択で課金セッションは終了。次の検索では新しいトークンを使う
      onPick({ placeId: d.placeId, name: d.name, lat: d.lat, lng: d.lng });
    } catch {
      toast.show(SEARCH_ERROR, "error");
    } finally {
      setPicking(false);
    }
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
