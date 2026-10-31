import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-link";
import { ShopCard } from "@/components/shop-card";
import { requireUser } from "@/lib/auth/current-user";
import { shopCardsByIds } from "@/lib/filters/list-shops";
import { isUuid } from "@/lib/ids";
import { requestOrigin } from "@/lib/shared-lists/origin";
import { inviteUrlOf } from "@/lib/shared-lists/shared";
import { createServerClient } from "@/lib/supabase/server";
import { InviteCard } from "./invite-card";
import { LeaveButton, RemoveMemberButton } from "./member-buttons";
import { SharedOwnerMenu } from "./shared-owner-menu";

const DELETED_USER = "退会したユーザー";

type Profile = { nickname: string; login_id: string };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function SharedListPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createServerClient();
  // invite_token は列を明示して取らない。非メンバーの非公開リストは RLS でここに出てこない。
  const { data: list, error } = await supabase
    .from("shared_lists")
    .select("id, name, description, is_public, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!list) notFound();

  const [membersRes, itemsRes] = await Promise.all([
    supabase
      .from("shared_list_members")
      .select("user_id, role, joined_at, profiles(nickname, login_id)")
      .eq("shared_list_id", id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("shared_list_items")
      .select("shop_id, note, added_by, added_at, profiles(nickname)")
      .eq("shared_list_id", id)
      .order("added_at", { ascending: false }),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (itemsRes.error) throw itemsRes.error;

  const members = (membersRes.data ?? []).map((m) => ({
    userId: m.user_id as string,
    role: m.role as "owner" | "member",
    profile: one(m.profiles as Profile | Profile[] | null),
  }));
  const me = members.find((m) => m.userId === user.id);
  const isMember = !!me;
  const isOwner = me?.role === "owner";

  const items = itemsRes.data ?? [];
  // 削除済みの店は shop_index に出てこないので、ここで自然に外れる。
  const shops = await shopCardsByIds(
    supabase,
    items.map((i) => i.shop_id as string),
  );
  const itemByShop = new Map(items.map((i) => [i.shop_id as string, i]));

  let inviteUrl: string | null = null;
  if (isMember) {
    const { data: token, error: tokenError } = await supabase.rpc("get_invite_token", { p_list: id });
    if (tokenError || typeof token !== "string") throw tokenError ?? new Error("invite token missing");
    inviteUrl = inviteUrlOf(await requestOrigin(), token);
  }

  return (
    <main className="flex flex-1 flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <BackButton />
        <h1 className="m-0 min-w-0 flex-1 truncate text-base font-bold">{list.name}</h1>
        {isOwner && (
          <SharedOwnerMenu
            listId={id}
            name={list.name}
            description={list.description ?? ""}
            isPublic={list.is_public}
          />
        )}
      </header>
      <div className="flex flex-col gap-3 p-4">
        <div className="text-xs text-muted">
          {list.description ? `${list.description}・` : ""}
          {list.is_public ? "公開" : "メンバーのみ閲覧"}
        </div>
        {inviteUrl && <InviteCard listId={id} initialUrl={inviteUrl} isOwner={isOwner} />}

        <p className="m-0 flex items-baseline justify-between text-[13px] font-bold text-muted">
          <span>お店</span>
          <span>
            <span data-testid="list-count">{shops.length}店</span>
            {isMember && "・みんなで追加できます"}
          </span>
        </p>
        {shops.length === 0 ? (
          <p className="m-0 rounded-[10px] bg-surface-2 p-4 text-center text-[13px] text-muted">まだ店がありません</p>
        ) : (
          shops.map((s) => {
            const item = itemByShop.get(s.id);
            const adder = item?.added_by ? one(item.profiles as { nickname: string } | { nickname: string }[] | null) : null;
            const who = adder?.nickname ?? DELETED_USER;
            return (
              <div key={s.id} className="flex flex-col gap-1.5">
                <ShopCard shop={s} />
                <div className="rounded-lg bg-surface-2 px-2 py-1.5 text-xs text-muted">
                  {item?.note ? `${who}：${item.note}` : `${who}が追加`}
                </div>
              </div>
            );
          })
        )}

        <p className="m-0 text-[13px] font-bold text-muted">メンバー</p>
        {members.map((m) => {
          const nickname = m.profile?.nickname ?? DELETED_USER;
          return (
            <div key={m.userId} className="flex items-center gap-2.5 text-sm">
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ai-soft text-xs font-bold text-ai">
                {[...nickname][0]}
              </span>
              {m.profile ? (
                <Link href={`/users/${m.profile.login_id}`} className="text-inherit no-underline">
                  {nickname}
                </Link>
              ) : (
                nickname
              )}
              <span className="ml-auto flex items-center gap-1 text-xs text-muted">
                {m.role === "owner" ? "オーナー" : "メンバー"}
                {isOwner && m.role === "member" && (
                  <>
                    ・<RemoveMemberButton listId={id} userId={m.userId} nickname={nickname} />
                  </>
                )}
              </span>
            </div>
          );
        })}
        {isMember && !isOwner && <LeaveButton listId={id} userId={user.id} />}
      </div>
    </main>
  );
}
