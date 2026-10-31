export const ME_TABS = [
  { key: "lists", label: "マイリスト" },
  { key: "shared", label: "共有リスト" },
  { key: "logs", label: "自分の記録" },
  { key: "account", label: "アカウント" },
] as const;
export type MeTab = (typeof ME_TABS)[number]["key"];

export function parseMeTab(v: unknown): MeTab {
  return ME_TABS.find((t) => t.key === v)?.key ?? "lists";
}
