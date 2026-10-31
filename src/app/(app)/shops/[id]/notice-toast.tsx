"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/toast";

const MESSAGES: Record<string, { text: string; kind: "info" | "error" }> = {
  exists: { text: "すでに登録されています", kind: "info" },
  list_failed: { text: "「気になる」リストへの追加に失敗しました", kind: "error" },
};

export function NoticeToast({ notice }: { notice?: string }) {
  const toast = useToast();
  // 開発時の StrictMode で effect が 2 回走っても、トーストは 1 回だけ出す。
  const shown = useRef<string | undefined>(undefined);
  useEffect(() => {
    const m = notice ? MESSAGES[notice] : undefined;
    if (!m || shown.current === notice) return;
    shown.current = notice;
    toast.show(m.text, m.kind);
  }, [notice, toast]);
  return null;
}
