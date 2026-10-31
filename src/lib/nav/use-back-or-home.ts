"use client";

import { useRouter } from "next/navigation";

/** 同じサイト内から来たときだけ履歴を戻り、直接開いたときは地図（ホーム）へ。 */
export function useBackOrHome() {
  const router = useRouter();
  return () => {
    let fromSameOrigin = false;
    try {
      fromSameOrigin =
        !!document.referrer && new URL(document.referrer).origin === location.origin;
    } catch {
      fromSameOrigin = false;
    }
    if (fromSameOrigin && window.history.length > 1) router.back();
    else router.push("/map");
  };
}
