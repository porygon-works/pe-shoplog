import { logoutAction } from "@/app/(auth)/login/actions";
import { requireUser } from "@/lib/auth/current-user";

// 地図画面は後続タスクで実装する。ここではログイン後の到達先と、ログアウト導線だけを置く。
export default async function MapPage() {
  const user = await requireUser();
  return (
    <main className="flex flex-col gap-4 bg-surface p-4">
      <h1 className="text-lg font-bold">地図</h1>
      <p data-testid="current-nickname">{user.nickname} さん</p>
      <form action={logoutAction}>
        <button type="submit" className="btn">
          ログアウト
        </button>
      </form>
    </main>
  );
}
