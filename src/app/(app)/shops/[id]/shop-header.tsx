"use client";

import Link from "next/link";
import { useBackOrHome } from "@/lib/nav/use-back-or-home";

export function ShopHeader({ shopId, name }: { shopId: string; name: string }) {
  const back = useBackOrHome();
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
    </header>
  );
}
