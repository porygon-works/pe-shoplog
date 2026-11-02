import { isUuid } from "@/lib/ids";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getCategories } from "@/lib/categories";
import { genresText } from "@/lib/category-utils";
import {
  PAYMENT_METHODS,
  PHOTO_KINDS,
  PRICE_RANGES,
  RESERVATIONS,
  SMOKING,
  labelOf,
  timeSlotsText,
} from "@/lib/options";
import { Stars, ratingText } from "@/components/rating";
import { googleMapsUrl } from "@/lib/shops/google-maps-url";
import { createServerClient } from "@/lib/supabase/server";
import { summarizeVisits, type Count } from "@/lib/visits/summarize";
import { ShopIllustration } from "@/components/shop-illustration";
import { GooglePhoto } from "./google-photo";
import { NoticeToast } from "./notice-toast";
import { PhotoGallery, type GalleryPhoto } from "./photo-gallery";
import { ShopHeader } from "./shop-header";
import { ShopListButtons } from "./shop-list-buttons";
import { VisitAdminActions } from "./visit-admin-actions";
import { VisitOwnerActions } from "./visit-owner-actions";
import { WebsiteButton } from "./website-button";

type VisitRow = {
  id: string;
  user_id: string | null;
  visited_on: string | null;
  rating: number | null;
  party_size: number | null;
  price_range: string;
  purpose: string;
  reservation: string;
  payment_methods: string[];
  comment: string | null;
  profiles: { nickname: string; login_id: string } | null;
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
        "id, user_id, visited_on, rating, party_size, price_range, purpose, reservation, payment_methods, comment, profiles(nickname, login_id)",
      )
      .eq("shop_id", id)
      .is("deleted_at", null)
      .order("visited_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("photos")
      .select("id, visit_id, kind, storage_path, width, height")
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
      priceRange: v.price_range,
      purpose: v.purpose,
      reservation: v.reservation,
      paymentMethods: v.payment_methods,
      partySize: v.party_size,
    })),
  );

  const smoking: string = shop.smoking;
  const priceRange: string = shop.price_range;
  const categories = await getCategories();
  const genreLabel = genresText(categories.genres, (shop.genres ?? []) as string[]);
  const stylesLabel = ((shop.styles ?? []) as string[]).map((s) => labelOf(categories.styles, s)).join("・");
  const avgText = ratingText(shop.avg_rating, shop.rating_count);
  // 一番上の写真: 横長・正方形を先に、縦長は後ろに回して最大 3 枚。高さはどの店でも 190px にそろえる。
  const portraitIds = new Set(
    photoRows.filter((p) => p.width && p.height && p.height > p.width).map((p) => p.id),
  );
  const heroPhotos = [
    ...photos.filter((p) => !portraitIds.has(p.id)),
    ...photos.filter((p) => portraitIds.has(p.id)),
  ].slice(0, 3);
  const allPortrait = heroPhotos.length > 0 && heroPhotos.every((p) => portraitIds.has(p.id));
  const heroAlt = (p: GalleryPhoto) => `${labelOf(PHOTO_KINDS, p.kind)}の写真`;
  let userHero: React.ReactNode = null;
  if (allPortrait && heroPhotos.length === 1) {
    // 縦長 1 枚: ぼかした同じ写真を背景に敷き、写真は切らずに中央に出す。
    const p = heroPhotos[0];
    userHero = (
      <div className="relative h-[190px] overflow-hidden bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl opacity-70" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.url} alt={heroAlt(p)} className="relative mx-auto h-full w-auto object-contain" />
      </div>
    );
  } else if (allPortrait) {
    // 縦長が 2〜3 枚: 縦長の列として横に並べる。
    userHero = (
      <div className={`grid h-[190px] grid-rows-1 gap-1 ${heroPhotos.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {heroPhotos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.url} alt={heroAlt(p)} className="h-full min-h-0 w-full bg-surface-2 object-cover" />
        ))}
      </div>
    );
  } else if (heroPhotos.length > 0) {
    // 横長が先頭: 1 枚なら横いっぱい、2 枚なら半分ずつ、3 枚なら大 1 枚 + 小 2 枚。
    userHero = (
      <div
        className={`grid h-[190px] gap-1 ${
          heroPhotos.length === 1 ? "grid-cols-1 grid-rows-1" : heroPhotos.length === 2 ? "grid-cols-2 grid-rows-1" : "grid-cols-[2fr_1fr] grid-rows-2"
        }`}
      >
        {heroPhotos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={p.url}
            alt={heroAlt(p)}
            className={`h-full min-h-0 w-full bg-surface-2 object-cover ${heroPhotos.length >= 3 && i === 0 ? "row-span-2" : ""}`}
          />
        ))}
      </div>
    );
  }
  const noPhoto = (
    <div data-testid="shop-illustration" className="flex h-[190px] flex-col items-center justify-center gap-1 bg-shu-soft text-shu">
      <ShopIllustration genres={(shop.genres ?? []) as string[]} styles={(shop.styles ?? []) as string[]} className="h-[110px] w-[110px]" />
      <span className="text-[11px] text-muted">写真はまだありません。行った人が追加できます。</span>
    </div>
  );

  return (
    <main className="flex flex-1 flex-col bg-surface">
      <NoticeToast notice={notice} />
      <ShopHeader shopId={id} name={shop.name} isAdmin={user.isAdmin} />

      {/* 一番上の写真: ユーザーの写真を優先。なければ Google の写真（1 枚）、それもなければイラスト。 */}
      {userHero ?? (shop.place_id ? <GooglePhoto placeId={shop.place_id} fallback={noPhoto} /> : noPhoto)}

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex min-h-[30px] items-center gap-2">
            <div className="flex-1 text-[15px] font-bold text-warn">
              {avgText ? <span data-testid="shop-rating">{avgText}</span> : <span className="text-[13px] font-normal text-muted">★ まだ評価なし</span>}
            </div>
            <Link href={`/shops/${id}/edit`} className="btn !px-3 !py-[5px] text-[13px]">
              店情報を編集
            </Link>
          </div>
          <dl data-testid="shop-categories" className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]">
            {(
              [
                ["ジャンル", genreLabel],
                ["形態", stylesLabel],
                ["時間帯", timeSlotsText((shop.time_slots ?? []) as string[])],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className={`m-0 ${v ? "font-bold" : "text-muted"}`}>{v || "未設定"}</dd>
              </div>
            ))}
          </dl>
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

        <ShopListButtons shopId={id} inWant={inWant} inFavorite={inFavorite} />

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
                <span className="text-[11px] text-muted">喫煙</span>
                <span className="text-[15px] font-bold">{labelOf(SMOKING, smoking)}</span>
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
              <Bars items={breakdown.purpose} options={categories.purposes} />
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
                <PhotoGallery photos={photos} isAdmin={user.isAdmin} />
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
                  {v.user_id !== null && v.profiles ? (
                    <Link href={`/users/${v.profiles.login_id}`} className="font-bold text-ink">
                      {who}
                    </Link>
                  ) : (
                    <b>{who}</b>
                  )}
                  <span className="text-xs text-muted">
                    {v.visited_on ?? "日付なし"}
                    {v.party_size !== null && `・${v.party_size}人`}
                  </span>
                  {v.user_id === user.id && <VisitOwnerActions visitId={v.id} />}
                  {user.isAdmin && v.user_id !== user.id && <VisitAdminActions visitId={v.id} />}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {v.rating !== null && <Stars rating={v.rating} />}
                  {v.purpose !== "unknown" && (
                    <span className={`${pill} bg-surface-2 text-muted`}>{labelOf(categories.purposes, v.purpose)}</span>
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

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom)+var(--nav-gap))] z-[2] mt-auto flex gap-2 border-t border-line bg-surface px-4 py-2.5">
        <Link href={`/shops/${id}/visits/new`} className="btn btn-accent flex-1">
          行った記録を付ける
        </Link>
      </div>
    </main>
  );
}
