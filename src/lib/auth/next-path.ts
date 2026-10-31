export const DEFAULT_NEXT_PATH = "/map";

/** ログイン後の戻り先。同一サイト内の相対パスだけを許可し、オープンリダイレクトを防ぐ。 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT_PATH;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_NEXT_PATH;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_NEXT_PATH;
  return raw;
}
