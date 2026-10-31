"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListPickerSheet, type ListPickerMode } from "@/components/list-picker-sheet";
import { useToast } from "@/components/toast";

/** 気になる / お気に入り / ＋リスト。押すとリスト選択シートを開き、閉じたら塗りつぶしの状態を取り直す。 */
export function ShopListButtons({
  shopId,
  inWant,
  inFavorite,
}: {
  shopId: string;
  inWant: boolean;
  inFavorite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<ListPickerMode | null>(null);
  const base = "btn flex-1 !px-2.5 !py-[7px] text-[13px]";

  const close = () => {
    setMode(null);
    router.refresh();
    toast.show("リストを更新しました");
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("want")}
          aria-pressed={inWant}
          className={`${base} ${inWant ? "!border-ai !bg-ai-soft !text-ai" : ""}`}
        >
          {inWant ? "★" : "☆"} 気になる
        </button>
        <button
          type="button"
          onClick={() => setMode("favorite")}
          aria-pressed={inFavorite}
          className={`${base} ${inFavorite ? "!border-shu !bg-shu-soft !text-shu" : ""}`}
        >
          {inFavorite ? "♥" : "♡"} お気に入り
        </button>
        <button type="button" onClick={() => setMode("any")} className={base}>
          ＋ リスト
        </button>
      </div>
      {mode && <ListPickerSheet shopId={shopId} mode={mode} onClose={close} />}
    </>
  );
}
