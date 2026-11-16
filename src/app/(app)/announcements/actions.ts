"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { createServerClient } from "@/lib/supabase/server";

/** お知らせ一覧を開いたら既読にする（マイページの鈴の赤い点が消える）。 */
export async function markAnnouncementsReadAction(): Promise<void> {
  const user = await requireUser();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("announcement_reads")
    .upsert({ user_id: user.id, read_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) {
    console.error("markAnnouncementsRead failed", error);
    return;
  }
  revalidatePath("/me");
}
