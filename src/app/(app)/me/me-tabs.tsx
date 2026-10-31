"use client";

import { useState } from "react";
import { ME_TABS, type MeTab } from "./tabs";

/** マイページのタブ。中身はサーバー側で用意して受け取り、切り替えだけをここで行う。 */
export function MeTabs({ initial, panels }: { initial: MeTab; panels: Record<MeTab, React.ReactNode> }) {
  const [tab, setTab] = useState<MeTab>(initial);
  return (
    <>
      <div role="tablist" aria-label="マイページ" className="flex gap-1 rounded-[10px] bg-surface-2 p-1">
        {ME_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg py-1.5 text-center text-[13px] ${
              tab === t.key ? "bg-surface font-bold text-ink shadow-sm" : "bg-transparent text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex flex-col gap-3">
        {panels[tab]}
      </div>
    </>
  );
}
