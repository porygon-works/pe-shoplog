export type Option<V extends string> = { value: V; label: string };

/** 単一の定義元。マイグレーションの CHECK 制約はここの値と一致させる。 */
export const SMOKING = [
  { value: "smoking_ok", label: "喫煙可" },
  { value: "separated", label: "分煙・喫煙室あり" },
  { value: "heated_only", label: "加熱式のみ" },
  { value: "no_smoking", label: "禁煙" },
  { value: "unknown", label: "不明" },
] as const satisfies readonly Option<string>[];

export const PRICE_RANGES = [
  { value: "under_3000", label: "〜2,999" },
  { value: "3000_4999", label: "3,000〜4,999" },
  { value: "5000_6999", label: "5,000〜6,999" },
  { value: "7000_9999", label: "7,000〜9,999" },
  { value: "over_10000", label: "10,000〜" },
  { value: "unknown", label: "不明" },
] as const satisfies readonly Option<string>[];

export const PURPOSES = [
  { value: "team_meeting", label: "チーム会議" },
  { value: "all_hands", label: "社員総会" },
  { value: "celebration", label: "打ち上げ" },
  { value: "welcome_farewell", label: "歓送迎会" },
  { value: "peers_only", label: "同期のみ" },
  { value: "entertainment", label: "接待" },
  { value: "private", label: "プライベート" },
  { value: "other", label: "その他" },
  { value: "unknown", label: "不明" },
] as const satisfies readonly Option<string>[];

export const RESERVATIONS = [
  { value: "reserved", label: "予約した" },
  { value: "walk_in", label: "予約なしで入れた" },
  { value: "unknown", label: "不明" },
] as const satisfies readonly Option<string>[];

/** 未選択＝不明。unknown 値は持たない。 */
export const PAYMENT_METHODS = [
  { value: "credit_card", label: "クレジットカード" },
  { value: "qr", label: "QR決済" },
  { value: "transit_ic", label: "交通系IC" },
  { value: "cash_only", label: "現金のみ" },
] as const satisfies readonly Option<string>[];

export const PHOTO_KINDS = [
  { value: "menu", label: "メニュー" },
  { value: "seat", label: "席" },
  { value: "food", label: "料理" },
  { value: "exterior", label: "外観" },
  { value: "other", label: "その他" },
] as const satisfies readonly Option<string>[];

export const GENRES = [
  { value: "washoku", label: "和食" },
  { value: "sushi_seafood", label: "寿司・海鮮" },
  { value: "yakiniku", label: "焼肉・ホルモン" },
  { value: "yakitori", label: "焼き鳥・串" },
  { value: "nabe", label: "鍋" },
  { value: "chinese", label: "中華" },
  { value: "korean", label: "韓国" },
  { value: "asian_ethnic", label: "アジア・エスニック" },
  { value: "italian", label: "イタリアン" },
  { value: "french_bistro", label: "フレンチ・ビストロ" },
  { value: "yoshoku", label: "洋食" },
  { value: "ramen", label: "ラーメン" },
  { value: "curry", label: "カレー" },
  { value: "cafe", label: "カフェ" },
  { value: "other", label: "その他" },
  { value: "unknown", label: "不明" },
] as const satisfies readonly Option<string>[];

export const STYLES = [
  { value: "taishu_izakaya", label: "大衆居酒屋" },
  { value: "izakaya", label: "居酒屋" },
  { value: "dining_bar", label: "ダイニングバー" },
  { value: "bar", label: "バー" },
  { value: "tachinomi", label: "立ち飲み" },
  { value: "private_room", label: "個室あり" },
  { value: "karaoke", label: "カラオケ" },
  { value: "other", label: "その他" },
] as const satisfies readonly Option<string>[];

export const LIST_KINDS = [
  { value: "want", label: "気になる" },
  { value: "favorite", label: "お気に入り" },
] as const satisfies readonly Option<string>[];

/** 選択肢の value 一覧（zod の enum や SQL の CHECK 制約に使う）。 */
export function values<const O extends readonly Option<string>[]>(
  options: O,
): [O[number]["value"], ...O[number]["value"][]] {
  return options.map((o) => o.value) as [
    O[number]["value"],
    ...O[number]["value"][],
  ];
}

export function labelOf(
  options: readonly Option<string>[],
  value: string,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
