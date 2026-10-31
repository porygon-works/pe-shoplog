export type ListKind = "want" | "favorite";

export const LIST_KIND_LABEL: Record<ListKind, string> = { want: "気になる", favorite: "お気に入り" };

export const LIST_NAME_MAX = 30;

/** リスト名を整えて検証する。不正なら null。 */
export function normalizeListName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const v = name.trim();
  return v.length >= 1 && v.length <= LIST_NAME_MAX ? v : null;
}

/** リスト選択シートの 1 行。 */
export type PickerList = {
  id: string;
  name: string;
  kind: ListKind;
  isPublic: boolean;
  isDefault: boolean;
  /** この店がすでに入っているか */
  included: boolean;
  createdAt: string;
};

/** 既定のリストを先頭に、次に気になる→お気に入り、最後は作成順。 */
export function sortPickerLists<T extends Pick<PickerList, "isDefault" | "kind" | "createdAt">>(lists: T[]): T[] {
  const rank = (l: T) => (l.isDefault ? 0 : 1);
  const kindRank = (l: T) => (l.kind === "want" ? 0 : 1);
  return [...lists].sort(
    (a, b) => rank(a) - rank(b) || kindRank(a) - kindRank(b) || a.createdAt.localeCompare(b.createdAt),
  );
}

const EXCERPT_LENGTH = 40;

/** 記録のコメントを先頭 40 文字に切る。切ったときは「…」を付ける。 */
export function excerptOf(comment: string | null): string | null {
  if (!comment) return null;
  const chars = [...comment];
  return chars.length > EXCERPT_LENGTH ? `${chars.slice(0, EXCERPT_LENGTH).join("")}…` : comment;
}
