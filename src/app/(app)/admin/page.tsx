import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { BackButton } from "@/components/back-link";
import { PassphraseForm } from "./passphrase-form";
import { RefreshLocationsButton } from "./refresh-locations-button";
import { UserRow, type AdminUser } from "./user-row";

export const metadata = { title: "管理画面" };

export default async function AdminPage() {
  const me = await requireAdmin();
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, login_id, nickname, is_admin, disabled_at, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const users: AdminUser[] = (data ?? []).map((p) => ({
    id: p.id,
    loginId: p.login_id,
    nickname: p.nickname,
    isAdmin: p.is_admin,
    disabled: p.disabled_at !== null,
    createdOn: String(p.created_at).slice(0, 10),
    isSelf: p.id === me.id,
  }));

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 pb-24">
      <BackButton />
      <h1 className="m-0 text-lg font-bold">管理画面</h1>

      <Link href="/admin/categories" className="btn self-start">
        ジャンル・形態・用途の編集
      </Link>

      <section className="flex flex-col gap-2">
        <h2 className="m-0 text-[13px] font-bold text-muted">店の位置</h2>
        <RefreshLocationsButton />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="m-0 text-[13px] font-bold text-muted">合言葉</h2>
        <PassphraseForm />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="m-0 flex justify-between text-[13px] font-bold text-muted">
          <span>ユーザー</span>
          <span>{users.length}人</span>
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="admin-users">
          {users.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </ul>
      </section>
    </main>
  );
}
