import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createServerClient } from "@/lib/supabase/server";
import { JoinButton } from "./join-button";

type Preview = {
  id: string;
  name: string;
  description: string | null;
  owner_nickname: string | null;
  member_count: number | string;
  shop_count: number | string;
  is_member: boolean;
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  // 未ログインは proxy が /login?next=/invite/<token> へ送る。
  await requireUser();
  const { token } = await params;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_invite_preview", { p_token: token.slice(0, 200) });
  if (error) throw error;
  const preview = ((data ?? []) as Preview[])[0];
  if (preview?.is_member) redirect(`/shared/${preview.id}`);

  return (
    <main className="flex flex-1 flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h1 className="m-0 flex-1 text-base font-bold">共有リストへの招待</h1>
      </header>
      <div className="flex flex-col gap-3 px-4 pt-10 text-center">
        {!preview ? (
          <>
            <p className="m-0 text-base font-bold">この招待リンクは無効です</p>
            <p className="m-0 text-[13px] text-muted">
              リンクが作り直された可能性があります。招待した人に新しいリンクを聞いてください。
            </p>
            <Link href="/me?tab=shared" className="btn">
              マイページへ
            </Link>
          </>
        ) : (
          <>
            <div className="text-[13px] text-muted">{preview.owner_nickname ?? "退会したユーザー"} さんから招待されています</div>
            <div className="font-display text-2xl text-ai">{preview.name}</div>
            <div className="text-xs text-muted">
              {preview.description ? `${preview.description}・` : ""}メンバー{Number(preview.member_count)}人・
              {Number(preview.shop_count)}店
            </div>
            <JoinButton token={token} />
          </>
        )}
      </div>
    </main>
  );
}
