import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { isUuid } from "@/lib/ids";
import { getPlaceWebsite } from "@/lib/places/google";
import { createServerClient } from "@/lib/supabase/server";

function Message({ shopId, children }: { shopId: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col gap-4 bg-surface p-4">
      <p role="alert" className="m-0 rounded-[10px] bg-surface-2 p-3 text-[13px]">
        {children}
      </p>
      <Link href={`/shops/${shopId}`} className="btn">
        店の詳細に戻る
      </Link>
    </main>
  );
}

/** タップされた時だけ Google からサイト URL を取得して、そこへ移動する（URL は保存しない）。 */
export default async function ShopWebsitePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createServerClient();
  const { data: shop, error } = await supabase
    .from("shops")
    .select("place_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!shop?.place_id) notFound();

  let url: string | null;
  try {
    url = await getPlaceWebsite(shop.place_id);
  } catch (e) {
    console.error("getPlaceWebsite failed", e);
    return <Message shopId={id}>サイト情報を取得できませんでした。時間をおいてもう一度お試しください</Message>;
  }

  if (url && /^https?:\/\//i.test(url)) redirect(url);
  return <Message shopId={id}>この店のサイト情報はGoogleマップにありません</Message>;
}
