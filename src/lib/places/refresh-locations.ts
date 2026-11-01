import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlaceLocation } from "@/lib/places/google";

type Loc = { lat: number; lng: number };

export type RefreshDeps = {
  listStale(limit: number): Promise<{ id: string; placeId: string }[]>;
  fetchLocation(placeId: string): Promise<Loc>;
  save(id: string, loc: Loc): Promise<void>;
};

const CONCURRENCY = 5;

/** 緯度経度は 30 日までしか保存できないため、古いものを取り直す。1 件の失敗は他に影響させない。 */
export async function refreshStaleLocations(
  deps: RefreshDeps,
  limit = 200,
): Promise<{ updated: number; failed: number }> {
  const stale = await deps.listStale(limit);
  let updated = 0;
  let failed = 0;
  let next = 0;

  async function worker() {
    while (next < stale.length) {
      const shop = stale[next++];
      try {
        const loc = await deps.fetchLocation(shop.placeId);
        await deps.save(shop.id, loc);
        updated++;
      } catch (e) {
        failed++;
        console.error("refresh-locations failed", shop.id, e instanceof Error ? e.message : e);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, stale.length) }, worker));
  return { updated, failed };
}

/** 本番用の依存。25 日より古い（または未取得の）place_id 付きの店が対象。 */
export function createRefreshDeps(): RefreshDeps {
  const db = createAdminClient();
  return {
    async listStale(limit) {
      const cutoff = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await db
        .from("shops")
        .select("id, place_id")
        .not("place_id", "is", null)
        .is("deleted_at", null)
        .or(`location_fetched_at.is.null,location_fetched_at.lt.${cutoff}`)
        .order("location_fetched_at", { ascending: true, nullsFirst: true })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id as string, placeId: r.place_id as string }));
    },
    fetchLocation: getPlaceLocation,
    async save(id, loc) {
      const { error } = await db
        .from("shops")
        .update({ lat: loc.lat, lng: loc.lng, location_fetched_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
  };
}
