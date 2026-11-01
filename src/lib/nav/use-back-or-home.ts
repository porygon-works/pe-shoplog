"use client";

import { useRouter } from "next/navigation";
import { readNavCount, shouldGoBack } from "./in-app-history";

/** アプリ内で画面を移動していれば履歴を戻り、最初の画面なら地図（ホーム）へ。 */
export function useBackOrHome() {
  const router = useRouter();
  return () => {
    if (shouldGoBack(readNavCount())) router.back();
    else router.push("/map");
  };
}
