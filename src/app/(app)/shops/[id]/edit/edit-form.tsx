"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ChipGroup } from "@/components/chip-group";
import { GENRES, STYLES } from "@/lib/options";
import type { ShopInput } from "@/lib/validation";
import { updateShopAction, type EditShopState } from "./actions";

export function EditShopForm({
  shopId,
  initial,
}: {
  shopId: string;
  initial: { name: string; genre: ShopInput["genre"]; styles: ShopInput["styles"]; referenceUrl: string };
}) {
  const [state, action, pending] = useActionState<EditShopState, FormData>(updateShopAction, {});
  const [name, setName] = useState(initial.name);
  const [genre, setGenre] = useState(initial.genre);
  const [styles, setStyles] = useState(initial.styles);
  const [referenceUrl, setReferenceUrl] = useState(initial.referenceUrl);

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
        <span className="text-[13px] font-bold text-muted">ジャンル</span>
        <ChipGroup name="genre" options={GENRES} value={genre} onChange={setGenre} aria-label="ジャンル" />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-muted">店の形態（複数可）</span>
        <ChipGroup name="styles" multiple options={STYLES} value={styles} onChange={setStyles} aria-label="店の形態" />
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
        <Link href={`/shops/${shopId}`} className="btn">
          キャンセル
        </Link>
        <button type="submit" className="btn btn-primary" disabled={pending || name.trim() === ""}>
          保存
        </button>
      </div>
      <p className="m-0 text-xs text-muted">店情報はログインしている人ならだれでも編集できます。</p>
    </form>
  );
}
