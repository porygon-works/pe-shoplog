"use client";

import Link from "next/link";
import { useCategories } from "@/components/categories-provider";
import { genresText, type Categories } from "@/lib/category-utils";
import { ratingText } from "@/components/rating";
import { ShopIllustration } from "@/components/shop-illustration";
import { PRICE_RANGES, SMOKING, labelOf, timeSlotsText } from "@/lib/options";

/** 店カードに必要な最小限の項目。一覧系の画面で共有する。 */
export type ShopCardData = {
  id: string;
  name: string;
  genres: string[];
  styles: string[];
  timeSlots: string[];
  visitCount: number;
  avgRating: number | null;
  ratingCount: number;
  smoking: string;
  priceRange: string;
  thumbUrl: string | null;
};

const pill = "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px]";

function smokePill(v: string) {
  if (v === "no_smoking") return "bg-ok-soft text-ok";
  if (v === "unknown") return "bg-surface-2 text-muted";
  return "bg-warn-soft text-warn";
}

export function ShopThumb({
  url,
  genres,
  styles,
  size = 72,
}: {
  url: string | null;
  genres: readonly string[];
  styles: readonly string[];
  size?: number;
}) {
  const style = { width: size, height: size };
  if (!url) {
    // 写真がなければジャンル・形態ごとのイラスト。
    return (
      <div style={style} className="grid flex-none place-items-center rounded-[10px] bg-shu-soft text-shu">
        <ShopIllustration genres={genres} styles={styles} className="h-[72%] w-[72%]" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" style={style} className="flex-none rounded-[10px] bg-surface-2 object-cover" />
  );
}

export function ShopPills({ shop }: { shop: ShopCardData }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ratingText(shop.avgRating, shop.ratingCount) && (
        <span className={`${pill} bg-warn-soft font-bold text-warn`}>{ratingText(shop.avgRating, shop.ratingCount)}</span>
      )}
      {shop.visitCount === 0 && <span className={`${pill} bg-ai-soft font-bold text-ai`}>気になる（未訪問）</span>}
      <span className={`${pill} ${smokePill(shop.smoking)}`}>
        {shop.smoking === "unknown" ? "喫煙 不明" : labelOf(SMOKING, shop.smoking)}
      </span>
      {shop.priceRange !== "unknown" && (
        <span className={`${pill} bg-shu-soft text-shu`}>¥{labelOf(PRICE_RANGES, shop.priceRange)}</span>
      )}
    </div>
  );
}

/** 非表示の区分も含めて表示名を引く（見つからなければ value のまま）。 */
export function shopMeta(shop: ShopCardData, categories: Categories): string {
  const genre = genresText(categories.genres, shop.genres);
  const styles = shop.styles.map((s) => labelOf(categories.styles, s)).join("・");
  return [genre, styles, timeSlotsText(shop.timeSlots), `記録 ${shop.visitCount}件`].filter(Boolean).join("・");
}

export function ShopCard({ shop }: { shop: ShopCardData }) {
  const categories = useCategories();
  return (
    <Link
      href={`/shops/${shop.id}`}
      data-testid="shop-card"
      className="flex gap-3 rounded-[14px] border border-line bg-surface p-3 text-inherit no-underline hover:border-ai"
    >
      <ShopThumb url={shop.thumbUrl} genres={shop.genres} styles={shop.styles} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-[15px] font-bold">{shop.name}</div>
        <div className="text-xs text-muted">{shopMeta(shop, categories)}</div>
        <ShopPills shop={shop} />
      </div>
    </Link>
  );
}
