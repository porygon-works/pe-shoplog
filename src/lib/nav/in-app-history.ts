export const NAV_COUNT_KEY = "pe-nav-count";
export const NAV_LAST_KEY = "pe-nav-last";

/** アプリ内で 2 画面以上たどっていれば履歴を戻れる。それ以外はホーム（地図）へ。 */
export function shouldGoBack(count: number): boolean {
  return Number.isFinite(count) && count > 1;
}

export function readNavCount(): number {
  try {
    const n = Number(sessionStorage.getItem(NAV_COUNT_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** 画面（パス）が変わったときに数える。同じパスの再実行（Strict Mode・再読み込み）は数えない。 */
export function incrementNavCount(pathname: string): void {
  try {
    if (sessionStorage.getItem(NAV_LAST_KEY) === pathname) return;
    sessionStorage.setItem(NAV_LAST_KEY, pathname);
    sessionStorage.setItem(NAV_COUNT_KEY, String(readNavCount() + 1));
  } catch {
    // sessionStorage が使えない環境では数えない（戻るは地図へ）。
  }
}
