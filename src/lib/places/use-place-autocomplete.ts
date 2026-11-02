"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";

export type PickedPlace = { placeId: string; name: string; lat: number; lng: number };
export type Suggestion = { placeId: string; mainText: string; secondaryText: string };

export const SEARCH_ERROR = "お店の検索に失敗しました。時間をおいてもう一度お試しください";
export const LIMIT_ERROR = "今日のお店の検索回数の上限に達しました。明日もう一度お試しください";
const DEBOUNCE_MS = 300;

/**
 * Google の店舗候補（autocomplete）を引き、選ばれた候補の名前と位置（details）を取る。
 * getBias を渡すと、その位置の近くの店を優先する。
 */
export function usePlaceAutocomplete(getBias?: () => { lat: number; lng: number } | null) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searched, setSearched] = useState(false);
  const [picking, setPicking] = useState(false);
  // Places の課金セッション。検索を始めるときに作り、details を取るまで使い回す。
  const session = useRef<string | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const biasRef = useRef(getBias);
  useEffect(() => {
    biasRef.current = getBias;
  }, [getBias]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const search = useCallback(
    async (q: string, token: string, mine: number) => {
      try {
        const params = new URLSearchParams({ q, session: token });
        const bias = biasRef.current?.();
        if (bias) {
          params.set("lat", String(bias.lat));
          params.set("lng", String(bias.lng));
        }
        const res = await fetch(`/api/places/autocomplete?${params}`);
        if (res.status === 429) {
          if (mine === seq.current) toast.show(LIMIT_ERROR, "error");
          return;
        }
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

  /** 候補を選んで名前と位置を取る。失敗したら toast を出して null。 */
  const pick = async (s: Suggestion): Promise<PickedPlace | null> => {
    if (picking) return null;
    setPicking(true);
    seq.current++; // 選択後に遅れて届く検索結果は無視する
    if (timer.current) clearTimeout(timer.current);
    try {
      const params = new URLSearchParams({ id: s.placeId });
      if (session.current) params.set("session", session.current);
      const res = await fetch(`/api/places/details?${params}`);
      if (res.status === 429) {
        toast.show(LIMIT_ERROR, "error");
        return null;
      }
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as PickedPlace;
      session.current = null; // 選択で課金セッションは終了。次の検索では新しいトークンを使う
      return { placeId: d.placeId, name: d.name, lat: d.lat, lng: d.lng };
    } catch {
      toast.show(SEARCH_ERROR, "error");
      return null;
    } finally {
      setPicking(false);
    }
  };

  // 画面の準備（hydration）が終わる前に入力された文字は onChange が来ないので、準備ができた時点で拾って検索する。
  const inputRef = useRef<HTMLInputElement>(null);
  const onInputRef = useRef(onInput);
  useEffect(() => {
    onInputRef.current = onInput;
  });
  useEffect(() => {
    const early = inputRef.current?.value;
    if (early) onInputRef.current(early);
  }, []);

  const reset = () => {
    seq.current++;
    if (timer.current) clearTimeout(timer.current);
    setQuery("");
    setSuggestions([]);
    setSearched(false);
  };

  return { query, onInput, suggestions, searched, picking, pick, reset, inputRef };
}
