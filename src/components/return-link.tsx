"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useReturnTo } from "@/lib/nav/use-return-to";

/**
 * 入力画面などから元の画面へ戻るリンク。ひとつ前がその画面なら履歴を戻り、そうでなければ今の画面を置き換える。
 * ふつうのリンク（push）だと、戻るで入力画面と元の画面を行き来してしまう。
 */
export function ReturnLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const returnTo = useReturnTo();
  return (
    <Link
      href={href}
      replace
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        returnTo(href);
      }}
    >
      {children}
    </Link>
  );
}
