import type { SearchParams } from "nuqs/server";
import { logoutAction } from "@/app/(auth)/login/actions";
import { requireUser } from "@/lib/auth/current-user";
import { listShops } from "@/lib/filters/list-shops";
import { shopFilterCache } from "@/lib/filters/shop-filters";
import { createServerClient } from "@/lib/supabase/server";
import { MapScreen } from "./map-screen";

export default async function MapPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const filters = shopFilterCache.parse(await searchParams);
  const shops = await listShops(await createServerClient(), filters);

  return (
    <main className="flex flex-1 flex-col bg-surface">
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
      <MapScreen shops={shops} />
    </main>
  );
}
