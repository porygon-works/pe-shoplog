"use client";

import { useBackOrHome } from "@/lib/nav/use-back-or-home";

export function BackButton() {
  const back = useBackOrHome();
  return (
    <button type="button" onClick={back} className="bg-transparent p-0 text-[13px] text-ai">
      ← 戻る
    </button>
  );
}
