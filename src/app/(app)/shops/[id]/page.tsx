import { isUuid } from "@/lib/ids";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import {
  GENRES,
  PAYMENT_METHODS,
  PHOTO_KINDS,
  PRICE_RANGES,
  PURPOSES,
  RESERVATIONS,
  SMOKING,
  STYLES,
  labelOf,
} from "@/lib/options";
import { googleMapsUrl } from "@/lib/shops/google-maps-url";
import { createServerClient } from "@/lib/supabase/server";
import { summarizeVisits, type Count } from "@/lib/visits/summarize";
import { NoticeToast } from "./notice-toast";
import { PhotoGallery, type GalleryPhoto } from "./photo-gallery";
import { ShopHeader } from "./shop-header";
import { ShopListButtons } from "./shop-list-buttons";
import { WebsiteButton } from "./website-button";

type VisitRow = {
  id: string;
  user_id: string | null;
  visited_on: string;
  party_size: number | null;
  smoking: string;
  price_range: string;
  purpose: string;
  reservation: string;
  payment_methods: string[];
  comment: string | null;
  profiles: { nickname: string } | null;
};

const SIGNED_URL_SECONDS = 3600;

function smokePill(v: string) {
  if (v === "no_smoking") return "bg-ok-soft text-ok";
  if (v === "unknown") return "bg-surface-2 text-muted";
  return "bg-warn-soft text-warn";
}

const pill = "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px]";

function Bars({ items, options }: { items: Count[]; options: readonly { value: string; label: string }[] }) {
  if (items.length === 0) return <p className="m-0 text-xs text-muted">まだ記録がありません</p>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((i) => (
        <div key={i.value} className="grid grid-cols-[84px_1fr_28px] items-center gap-2 text-[13px]">
          <span>{labelOf(options, i.value)}</span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-ai" style={{ width: `${(i.count / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-muted">{i.count}</span>
        </div>
      ))}
    </div>
  );
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { notice } = await searchParams;
  if (!isUuid(id)) notFound();

  const supabase = await createServerClient();
  const { data: shop, error: shopError } = await supabase
    .from("shop_index")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (shopError) throw shopError;
  if (!shop) notFound();

  const [visitsRes, photosRes, listsRes] = await Promise.all([
    supabase
      .from("visits")
      .select(
        "id, user_id, visited_on, party_size, smoking, price_range, purpose, reservation, payment_methods, comment, profiles(nickname)",
      )
      .eq("shop_id", id)
      .is("deleted_at", null)
      .order("visited_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("photos")
      .select("id, visit_id, kind, storage_path")
      .eq("shop_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    // 自分のリストのうち、この店が入っているもの（RLS で他人の非公開リストは見えない）
    supabase
      .from("lists")
      .select("kind, list_items!inner(shop_id)")
      .eq("owner_id", user.id)
      .eq("list_items.shop_id", id),
  ]);
  if (visitsRes.error) throw visitsRes.error;
  if (photosRes.error) throw photosRes.error;
  if (listsRes.error) throw listsRes.error;

  const visits = (visitsRes.data ?? []) as unknown as VisitRow[];
  const liveVisitIds = new Set(visits.map((v) => v.id));
  // 削除された記録の写真は出さない
  const photoRows = (photosRes.data ?? []).filter((p) => liveVisitIds.has(p.visit_id));

  let photos: GalleryPhoto[] = [];
  if (photoRows.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from("photos")
      .createSignedUrls(
        photoRows.map((p) => p.storage_path),
        SIGNED_URL_SECONDS,
      );
    if (signError) throw signError;
    const urlByPath = new Map<string, string>();
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    photos = photoRows.flatMap((p) => {
      const url = urlByPath.get(p.storage_path);
      return url ? [{ id: p.id, kind: p.kind, url }] : [];
    });
  }

  const kinds = new Set((listsRes.data ?? []).map((l) => l.kind));
  const inWant = kinds.has("want");
  const inFavorite = kinds.has("favorite");

  const hasVisits = visits.length > 0;
  const breakdown = summarizeVisits(
    visits.map((v) => ({
      smoking: v.smoking,
      priceRange: v.price_range,
      purpose: v.purpose,
      reservation: v.reservation,
      paymentMethods: v.payment_methods,
      partySize: v.party_size,
    })),
  );

  const smoking: string = shop.smoking;
  const priceRange: string = shop.price_range;
  const genreLabel = labelOf(GENRES, shop.genre);
  const stylesLabel = ((shop.styles ?? []) as string[]).map((s) => labelOf(STYLES, s)).join("・");
  const heroPhotos = photos.slice(0, 3);

  return (
    <main className="flex flex-1 flex-col bg-surface">
      <NoticeToast notice={notice} />
      <ShopHeader shopId={id} name={shop.name} />

      {heroPhotos.length > 0 ? (
        <div className="grid h-[190px] grid-cols-[2fr_1fr] grid-rows-2 gap-1">
          {heroPhotos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={p.url}
              alt={`${labelOf(PHOTO_KINDS, p.kind)}の写真`}
              className={`h-full w-full bg-surface-2 object-cover ${i === 0 ? "row-span-2" : ""}`}
            />
          ))}
        </div>
      ) : (
        <div className="grid h-[120px] place-items-center bg-surface-2 text-[13px] text-muted">
          写真はまだありません。行った人が追加できます。
        </div>
      )}

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-xs text-muted">{[genreLabel, stylesLabel].filter(Boolean).join("・")}</div>
          <div className="flex flex-wrap gap-1">
            {!hasVisits && <span className={`${pill} bg-ai-soft font-bold text-ai`}>気になる（未訪問）</span>}
            <span className={`${pill} ${smokePill(smoking)}`}>
              {smoking === "unknown" ? "喫煙 不明" : labelOf(SMOKING, smoking)}
            </span>
            {priceRange !== "unknown" && (
              <span className={`${pill} bg-shu-soft text-shu`}>¥{labelOf(PRICE_RANGES, priceRange)}</span>
            )}
          </div>
        </div>

        <ShopListButtons inWant={inWant} inFavorite={inFavorite} />

        <div className="flex gap-2">
          {shop.place_id && <WebsiteButton shopId={id} />}
          <a
            href={googleMapsUrl({ name: shop.name, lat: shop.lat, lng: shop.lng, placeId: shop.place_id })}
            target="_blank"
            rel="noopener"
            className="btn flex-1 !px-2.5 !py-[7px] text-[13px]"
          >
            Googleマップで開く
          </a>
        </div>

        {shop.reference_url && (
          <div className="text-xs text-muted">
            予約・参考リンク:{" "}
            {/^https?:\/\//i.test(shop.reference_url) ? (
              <a href={shop.reference_url} target="_blank" rel="noopener noreferrer" className="break-all text-ai">
                {shop.reference_url}
              </a>
            ) : (
              <span className="break-all">{shop.reference_url}</span>
            )}
          </div>
        )}

        {!hasVisits ? (
          <div className="rounded-[10px] bg-ai-soft p-3 text-[13px] text-ai">
            まだ誰も行っていない「気になる」店です。行ったら記録を付けてみんなに教えてください。
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div data-testid="stat-smoking" className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
                <span className="text-[11px] text-muted">喫煙（最新の記録）</span>
                <span className="text-[15px] font-bold">{labelOf(SMOKING, smoking)}</span>
                <span className="text-[11px] text-muted">
                  {breakdown.smoking.map((c) => `${labelOf(SMOKING, c.value)} ${c.count}件`).join("・")}
                </span>
              </div>
              <div data-testid="stat-price" className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
                <span className="text-[11px] text-muted">値段感（1人あたり）</span>
                <span className="text-[15px] font-bold">
                  {priceRange === "unknown" ? "不明" : `¥${labelOf(PRICE_RANGES, priceRange)}`}
                </span>
                <span className="text-[11px] text-muted">いちばん多い回答</span>
              </div>
              <div data-testid="stat-max" className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
                <span className="text-[11px] text-muted">最大人数の実績</span>
                <span className="text-[15px] font-bold">
                  {breakdown.maxPartySize === null ? "不明" : `${breakdown.maxPartySize}人`}
                </span>
              </div>
              <div data-testid="stat-pay" className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
                <span className="text-[11px] text-muted">支払い</span>
                <span className="text-[13px] font-bold">
                  {breakdown.paymentMethods.length === 0
                    ? "不明"
                    : breakdown.paymentMethods.map((c) => labelOf(PAYMENT_METHODS, c.value)).join("・")}
                </span>
              </div>
            </div>

            <section className="flex flex-col gap-2">
              <h2 className="m-0 text-[13px] font-bold text-muted">使った用途</h2>
              <Bars items={breakdown.purpose} options={PURPOSES} />
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="m-0 text-[13px] font-bold text-muted">予約</h2>
              <Bars items={breakdown.reservation} options={RESERVATIONS} />
            </section>

            {photos.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="m-0 flex justify-between text-[13px] font-bold text-muted">
                  <span>写真</span>
                  <span>{photos.length}枚</span>
                </h2>
                <PhotoGallery photos={photos} />
              </section>
            )}
          </>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="m-0 flex justify-between text-[13px] font-bold text-muted">
            <span>行った記録</span>
            <span>{visits.length}件</span>
          </h2>
          {visits.map((v) => {
            const who = v.user_id === null ? "退会したユーザー" : (v.profiles?.nickname ?? "退会したユーザー");
            return (
              <div key={v.id} className="flex flex-col gap-1.5 border-t border-line pt-3">
                <div className="flex items-center gap-2 text-[13px]">
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 place-items-center rounded-full bg-ai-soft text-xs font-bold text-ai"
                  >
                    {[...who][0]}
                  </span>
                  <b>{who}</b>
                  <span className="text-xs text-muted">
                    {v.visited_on}
                    {v.party_size !== null && `・${v.party_size}人`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {v.purpose !== "unknown" && (
                    <span className={`${pill} bg-surface-2 text-muted`}>{labelOf(PURPOSES, v.purpose)}</span>
                  )}
                  {v.smoking !== "unknown" && (
                    <span className={`${pill} ${smokePill(v.smoking)}`}>{labelOf(SMOKING, v.smoking)}</span>
                  )}
                  {v.price_range !== "unknown" && (
                    <span className={`${pill} bg-shu-soft text-shu`}>¥{labelOf(PRICE_RANGES, v.price_range)}</span>
                  )}
                </div>
                {v.comment && <p className="m-0 whitespace-pre-wrap text-sm">{v.comment}</p>}
              </div>
            );
          })}
        </section>
      </div>

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-[2] mt-auto flex gap-2 border-t border-line bg-surface px-4 py-2.5">
        <Link href={`/shops/${id}/visits/new`} className="btn btn-accent flex-1">
          行った記録を付ける
        </Link>
      </div>
    </main>
  );
}
