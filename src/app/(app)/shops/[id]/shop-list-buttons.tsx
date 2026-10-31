"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListPickerSheet, type ListPickerMode } from "@/components/list-picker-sheet";
import { useToast } from "@/components/toast";
import { ensureInDefaultListAction } from "@/lib/lists/actions";
import type { ListKind } from "@/lib/lists/shared";

/**
 * 気になる / お気に入り / ＋リスト。押すとリスト選択シートを開き、閉じたら塗りつぶしの状態を取り直す。
 * 「気になる」「お気に入り」は、その種類のどのリストにも入っていなければ、先に既定のリストへ入れてから
 * 開く（既定のリストにチェックが付いた状態で開く）。すでに入っていれば今の状態のまま開く。
 * 「＋ リスト」は自動では追加しない。
 */
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
  const [autoAdded, setAutoAdded] = useState(false);
  const [opening, setOpening] = useState(false);
  const base = "btn flex-1 !px-2.5 !py-[7px] text-[13px]";

  async function openFor(kind: ListKind, filled: boolean) {
    if (!filled) {
      setOpening(true);
      try {
        const res = await ensureInDefaultListAction(shopId, kind);
        if ("error" in res) {
          toast.show(res.error, "error");
          return;
        }
        setAutoAdded(res.added);
      } catch {
        toast.show("リストに追加できませんでした。時間をおいてもう一度お試しください", "error");
        return;
      } finally {
        setOpening(false);
      }
    } else {
      setAutoAdded(false);
    }
    setMode(kind);
  }

  const close = (changed: boolean) => {
    setMode(null);
    if (changed || autoAdded) {
      router.refresh();
      toast.show("リストを更新しました");
    }
    setAutoAdded(false);
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void openFor("want", inWant)}
          disabled={opening}
          aria-pressed={inWant}
          className={`${base} ${inWant ? "!border-ai !bg-ai-soft !text-ai" : ""}`}
        >
          {inWant ? "★" : "☆"} 気になる
        </button>
        <button
          type="button"
          onClick={() => void openFor("favorite", inFavorite)}
          disabled={opening}
          aria-pressed={inFavorite}
          className={`${base} ${inFavorite ? "!border-shu !bg-shu-soft !text-shu" : ""}`}
        >
          {inFavorite ? "♥" : "♡"} お気に入り
        </button>
        <button type="button" onClick={() => {
            setAutoAdded(false);
            setMode("any");
          }} className={base}>
          ＋ リスト
        </button>
      </div>
      {mode && <ListPickerSheet shopId={shopId} mode={mode} onClose={close} />}
    </>
  );
}
