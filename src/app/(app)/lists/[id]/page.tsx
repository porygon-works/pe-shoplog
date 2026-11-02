import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-link";
import { ShopCard } from "@/components/shop-card";
import { requireUser } from "@/lib/auth/current-user";
import { shopCardsByIds } from "@/lib/filters/list-shops";
import { isUuid } from "@/lib/ids";
import { LIST_KIND_LABEL, type ListKind } from "@/lib/lists/shared";
import { createServerClient } from "@/lib/supabase/server";
import { ListOwnerMenu } from "./list-owner-menu";

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createServerClient();
  // RLS により、他人の非公開リストはここで見つからない。
  const { data: list, error } = await supabase
    .from("lists")
    .select("id, name, kind, is_public, is_default, owner_id, profiles(nickname, login_id)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!list) notFound();

  const { data: items, error: itemsError } = await supabase
    .from("list_items")
    .select("shop_id")
    .eq("list_id", id)
    .order("added_at", { ascending: false });
  if (itemsError) throw itemsError;
  // 削除済みの店は shop_index に出てこないので、ここで自然に外れる。
  const shops = await shopCardsByIds(
    supabase,
    (items ?? []).map((i) => i.shop_id as string),
  );

  const owner = (Array.isArray(list.profiles) ? list.profiles[0] : list.profiles) as {
    nickname: string;
    login_id: string;
  } | null;
  const isOwner = list.owner_id === user.id;

  return (
    <main className="flex flex-1 flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <BackButton />
        <h1 className="m-0 min-w-0 flex-1 truncate text-base font-bold">{list.name}</h1>
        {isOwner && (
          <ListOwnerMenu listId={id} name={list.name} isPublic={list.is_public} isDefault={list.is_default} />
        )}
      </header>
      <div className="flex flex-col gap-3 p-4">
        <div className="text-xs text-muted">
          {owner ? (
            <Link href={`/users/${owner.login_id}`} className="text-ai">
              {owner.nickname}
            </Link>
          ) : (
            "退会したユーザー"
          )}
          {" "}のリスト・{LIST_KIND_LABEL[list.kind as ListKind]}・
          {list.is_public ? "共有（ログインしている人が見られます）" : "自分だけ"}・
          <span data-testid="list-count">{shops.length}店</span>
        </div>
        {shops.length === 0 ? (
          <p className="m-0 rounded-[10px] bg-surface-2 p-4 text-center text-[13px] text-muted">まだ店がありません</p>
        ) : (
          shops.map((s) => <ShopCard key={s.id} shop={s} />)
        )}
      </div>
    </main>
  );
}
