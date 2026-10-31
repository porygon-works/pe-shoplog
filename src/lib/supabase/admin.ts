import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** secret キーを使う唯一の場所。RLS を迂回するので、呼び出し側で必ず権限確認すること。 */
export function createAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
