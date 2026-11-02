import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Google の従量課金の API（Places と地図の表示）の使用回数の上限。全員合計の 1 か月の上限は、Google の毎月の無料枠より少し下に置く
 * （無料枠: 検索候補・位置は 10,000 回、店名つきの詳細は 5,000 回、写真・公式サイトは 1,000 回）。
 * 1 人ごとの 1 日の上限は、誤操作やいたずらで無料枠を使い切らないため。
 * 上限に達したら Google を呼ばない（料金が発生しない）。
 */
export const PLACES_LIMITS = {
  autocomplete: { daily: 200, monthly: 9000 },
  details: { daily: 60, monthly: 4500 },
  // 写真は店の詳細を開くたびに使う。同じ店はブラウザで 30 分使い回すので、1 日 150 回あれば足りる。
  photo: { daily: 150, monthly: 900 },
  website: { daily: 30, monthly: 900 },
  // 地図の表示（Maps JavaScript API の地図読み込み）。Google 側では上限を変えられないため、アプリで止める。無料枠は月 10,000 回。
  mapload: { daily: 150, monthly: 9000 },
  // Google ではないが、だれでもできる区分（ジャンル・形態）の追加も、いたずらで増やされないよう回数を絞る。
  category: { daily: 20, monthly: 300 },
} as const;
export type PlacesKind = keyof typeof PLACES_LIMITS;

/** 1 回分を数え、上限内なら true。数えられなかったときも安全側（呼ばない）に倒す。 */
export async function consumePlacesQuota(kind: PlacesKind, userId: string): Promise<boolean> {
  const limit = PLACES_LIMITS[kind];
  const { data, error } = await createAdminClient().rpc("api_usage_hit", {
    p_user: userId,
    p_kind: kind,
    p_user_daily_limit: limit.daily,
    p_global_monthly_limit: limit.monthly,
  });
  if (error) {
    console.error("api_usage_hit failed", error);
    return false;
  }
  return data === true;
}
