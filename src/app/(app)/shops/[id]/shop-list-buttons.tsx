"use client";

import { useToast } from "@/components/toast";

/**
 * 気になる / お気に入り / ＋リスト。Task 12 でリスト選択シートを開く処理に差し替える。
 * それまではボタンと「入っているか」の表示だけを持つ。
 */
export function ShopListButtons({ inWant, inFavorite }: { inWant: boolean; inFavorite: boolean }) {
  const toast = useToast();
  const soon = () => toast.show("リスト機能は準備中です");
  const base = "btn flex-1 !px-2.5 !py-[7px] text-[13px]";
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={soon}
        aria-pressed={inWant}
        className={`${base} ${inWant ? "!border-ai !bg-ai-soft !text-ai" : ""}`}
      >
        {inWant ? "★" : "☆"} 気になる
      </button>
      <button
        type="button"
        onClick={soon}
        aria-pressed={inFavorite}
        className={`${base} ${inFavorite ? "!border-shu !bg-shu-soft !text-shu" : ""}`}
      >
        {inFavorite ? "♥" : "♡"} お気に入り
      </button>
      <button type="button" onClick={soon} className={base}>
        ＋ リスト
      </button>
    </div>
  );
}
