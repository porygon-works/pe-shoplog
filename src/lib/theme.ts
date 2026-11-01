/** 画面の明るさの設定。端末ごとに localStorage に保存する（ログインとは無関係）。 */
export const THEME_KEY = "pe-theme";
export type ThemeSetting = "system" | "light" | "dark";

export const THEME_OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: "system", label: "端末に合わせる" },
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
];

/** 描画前に html の data-theme を設定するインラインスクリプト（読み込み時のちらつき防止）。 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function readTheme(): ThemeSetting {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(t: ThemeSetting) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  try {
    if (t === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    // 保存できなくても、今開いている画面には反映される。
  }
}
