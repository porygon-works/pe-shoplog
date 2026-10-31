export const SHARED_DESCRIPTION_MAX = 100;
export const SHARED_NOTE_MAX = 200;

export function normalizeDescription(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length <= SHARED_DESCRIPTION_MAX ? (t === "" ? null : t) : undefined;
}

export function normalizeNote(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length <= SHARED_NOTE_MAX ? (t === "" ? null : t) : undefined;
}

/** リスト選択シートの共有リスト 1 行。 */
export type SharedPickerList = {
  id: string;
  name: string;
  memberCount: number;
  included: boolean;
  note: string;
};

/** 招待リンクの先頭（origin）と token から URL を作る。 */
export function inviteUrlOf(origin: string, token: string): string {
  return `${origin}/invite/${token}`;
}
