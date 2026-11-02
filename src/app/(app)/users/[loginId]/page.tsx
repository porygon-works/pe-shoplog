import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-link";
import { ListCard } from "@/components/list-card";
import { VisitLogList } from "@/components/visit-log-list";
import { requireUser } from "@/lib/auth/current-user";
import { isValidLoginId, normalizeLoginId } from "@/lib/auth/login-id";
import { listSummariesOf, visitLogOf } from "@/lib/lists/queries";
import { createServerClient } from "@/lib/supabase/server";

export default async function UserPage({ params }: { params: Promise<{ loginId: string }> }) {
  await requireUser();
  const { loginId: raw } = await params;
  let loginId = "";
  try {
    loginId = normalizeLoginId(decodeURIComponent(raw));
  } catch {
    notFound();
  }
  if (!isValidLoginId(loginId)) notFound();

  const supabase = await createServerClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, login_id, nickname")
    .eq("login_id", loginId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) notFound();

  const [lists, visits] = await Promise.all([listSummariesOf(supabase, profile.id), visitLogOf(supabase, profile.id)]);
  const publicLists = lists.filter((l) => l.isPublic);

  return (
    <main className="flex flex-1 flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <BackButton />
        <h1 className="m-0 min-w-0 flex-1 truncate text-base font-bold" data-testid="user-nickname">
          {profile.nickname}
        </h1>
        <span className="text-xs text-muted">{profile.login_id}</span>
      </header>
      <div className="flex flex-col gap-3 p-4">
        <p className="m-0 text-[13px] font-bold text-muted">共有リスト</p>
        {publicLists.length === 0 ? (
          <p className="m-0 rounded-[10px] bg-surface-2 p-4 text-center text-[13px] text-muted">
            共有しているリストはありません
          </p>
        ) : (
          publicLists.map((l) => <ListCard key={l.id} list={l} />)
        )}
        <p className="m-0 mt-2 text-[13px] font-bold text-muted">記録</p>
        <VisitLogList entries={visits} />
      </div>
    </main>
  );
}
