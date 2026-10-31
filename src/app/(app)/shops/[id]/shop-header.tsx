"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { softDeleteShopAction } from "@/app/(app)/admin/actions";
import { useBackOrHome } from "@/lib/nav/use-back-or-home";

export function ShopHeader({ shopId, name, isAdmin }: { shopId: string; name: string; isAdmin: boolean }) {
  const back = useBackOrHome();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();

  async function onDelete() {
    if (!(await confirm(`「${name}」を削除しますか？店と記録・写真が一覧に出なくなります。`))) return;
    try {
      const res = await softDeleteShopAction(shopId);
      if ("error" in res) toast.show(res.error, "error");
      else {
        toast.show("店を削除しました");
        router.replace("/map");
      }
    } catch (e) {
      console.error("softDeleteShop failed", e);
      toast.show("削除に失敗しました。時間をおいてもう一度お試しください", "error");
    }
  }

  return (
    <header className="flex items-center gap-2 border-b border-line px-4 py-3">
      <button type="button" onClick={back} className="bg-transparent p-0 text-[13px] text-ai">
        ← 戻る
      </button>
      <h1 className="m-0 min-w-0 flex-1 truncate text-base font-bold" data-testid="shop-name">
        {name}
      </h1>
      <Link href={`/shops/${shopId}/edit`} className="text-[13px] text-ai no-underline">
        編集
      </Link>
      {isAdmin && (
        <details className="relative">
          <summary aria-label="管理者メニュー" className="cursor-pointer list-none px-1 text-lg leading-none text-muted">
            ⋯
          </summary>
          <div className="absolute right-0 z-10 mt-1 rounded-xl border border-line bg-surface p-1 shadow-lg">
            <button type="button" onClick={() => void onDelete()} className="whitespace-nowrap bg-transparent px-3 py-2 text-[13px] text-shu">
              この店を削除
            </button>
          </div>
        </details>
      )}
    </header>
  );
}
