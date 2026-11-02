"use client";

import { ReturnLink } from "@/components/return-link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useReturnTo } from "@/lib/nav/use-return-to";
import { useCategories } from "@/components/categories-provider";
import { ChipGroup } from "@/components/chip-group";
import { genreOptions, selectableOptions } from "@/lib/category-utils";
import { TIME_SLOTS } from "@/lib/options";
import type { ShopInput } from "@/lib/validation";
import { updateShopAction, type EditShopState } from "./actions";

export function EditShopForm({
  shopId,
  initial,
}: {
  shopId: string;
  initial: { name: string; genres: ShopInput["genres"]; styles: ShopInput["styles"];
    timeSlots: ShopInput["timeSlots"];
    referenceUrl: string };
}) {
  const [state, action, pending] = useActionState<EditShopState, FormData>(updateShopAction, {});
  const categories = useCategories();
  const [name, setName] = useState(initial.name);
  const [genres, setGenres] = useState(initial.genres);
  const [styles, setStyles] = useState(initial.styles);
  const [timeSlots, setTimeSlots] = useState(initial.timeSlots);
  const [referenceUrl, setReferenceUrl] = useState(initial.referenceUrl);
  const returnTo = useReturnTo();
  const navigated = useRef(false);
  useEffect(() => {
    if (state.ok && !navigated.current) {
      navigated.current = true;
      returnTo(`/shops/${shopId}`);
    }
  }, [state.ok, returnTo, shopId]);

  return (
    <form action={action} className="flex flex-col gap-4 p-4">
      {state.error && (
        <p role="alert" className="m-0 rounded-[10px] bg-surface-2 p-3 text-[13px] text-shu">
          {state.error}
        </p>
      )}
      <input type="hidden" name="shopId" value={shopId} />

      <div className="flex flex-col gap-2">
        <label htmlFor="nm" className="text-[13px] font-bold text-muted">
          店名（必須）
        </label>
        <input id="nm" name="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-muted">ジャンル（複数可）</span>
        <ChipGroup name="genres" multiple options={genreOptions(categories.genres, initial.genres)} value={genres} onChange={setGenres} aria-label="ジャンル" />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-muted">店の形態（複数可）</span>
        <ChipGroup name="styles" multiple options={selectableOptions(categories.styles, initial.styles)} value={styles} onChange={setStyles} aria-label="店の形態" />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-muted">時間帯（複数可）</span>
        <ChipGroup name="timeSlots" multiple options={TIME_SLOTS} value={timeSlots} onChange={setTimeSlots} aria-label="時間帯" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="ref" className="text-[13px] font-bold text-muted">
          予約・参考リンク
        </label>
        <input
          id="ref"
          name="referenceUrl"
          type="url"
          className="input"
          value={referenceUrl}
          onChange={(e) => setReferenceUrl(e.target.value)}
          placeholder="ホットペッパーや食べログのURL（任意）"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ReturnLink href={`/shops/${shopId}`} className="btn">
          キャンセル
        </ReturnLink>
        <button type="submit" className="btn btn-primary" disabled={pending || name.trim() === "" || timeSlots.length === 0}>
          保存
        </button>
      </div>
      <p className="m-0 text-xs text-muted">店情報はログインしている人ならだれでも編集できます。</p>
    </form>
  );
}
