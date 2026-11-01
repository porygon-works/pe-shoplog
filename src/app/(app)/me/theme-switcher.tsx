"use client";

import { useSyncExternalStore } from "react";
import { THEME_OPTIONS, applyTheme, readTheme, type ThemeSetting } from "@/lib/theme";

const CHANGE = "pe-theme-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** アカウントタブの「画面の明るさ」。選ぶとその場で切り替わり、この端末に保存される。 */
export function ThemeSwitcher() {
  // 設定は localStorage にしかないので、サーバーでは「端末に合わせる」として描画し、読み込み後に実際の値へ合わせる。
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as ThemeSetting);

  const choose = (t: ThemeSetting) => {
    applyTheme(t);
    window.dispatchEvent(new Event(CHANGE));
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-muted">画面の明るさ</span>
      <div role="group" aria-label="画面の明るさ" className="grid grid-cols-3 gap-1.5">
        {THEME_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={theme === o.value}
            onClick={() => choose(o.value)}
            className={`rounded-[10px] border px-2 py-2 text-[13px] ${
              theme === o.value ? "border-ai bg-ai font-bold text-white dark:text-[#161112]" : "border-line bg-surface text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
