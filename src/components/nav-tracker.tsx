"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { incrementNavCount } from "@/lib/nav/in-app-history";

/** アプリ内で何画面開いたかを sessionStorage に数える（「戻る」の判定用）。 */
export function NavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    incrementNavCount(pathname);
  }, [pathname]);
  return null;
}
