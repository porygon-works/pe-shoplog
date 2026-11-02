import type { SearchParams } from "nuqs/server";
import { logoutAction } from "@/app/(auth)/login/actions";
import { requireUser } from "@/lib/auth/current-user";
import { listShops } from "@/lib/filters/list-shops";
import { shopFilterCache } from "@/lib/filters/shop-filters";
import { createServerClient } from "@/lib/supabase/server";
import { MapScreenBridge } from "./map-host";

export default async function MapPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = shopFilterCache.parse(await searchParams);
  // ログイン確認と店の取得を同時に進める（未ログインなら requireUser がリダイレクトし、店は RLS で空）。
  const [user, shops] = await Promise.all([
    requireUser(),
    createServerClient().then((supabase) => listShops(supabase, filters)),
  ]);

  return (
    <main className="flex flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="font-display text-base text-shu">
          ぺーろぐ
        </span>
        <span className="flex-1" />
        <span data-testid="current-nickname" className="text-xs text-muted">
          {user.nickname} さん
        </span>
        <form action={logoutAction}>
          <button type="submit" className="text-xs text-ai underline">
            ログアウト
          </button>
        </form>
      </header>
      {/* 地図そのものはレイアウトの MapHost が出す（画面を行き来しても地図を作り直さないため）。 */}
      <MapScreenBridge shops={shops} />
    </main>
  );
}
