"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { readPrevPath } from "./in-app-history";

/**
 * 入力画面（記録・店情報の編集など）の保存後に、結果の画面へ移る。
 * ひとつ前がその画面なら履歴を「戻って」最新に更新し、そうでなければ入力画面を置き換える。
 * どちらでも入力画面は履歴に残らないので、「戻る」で入力画面と詳細を行き来しない。
 */
export function useReturnTo() {
  const router = useRouter();
  return useCallback(
    (target: string) => {
      const path = target.split("?")[0];
      if (readPrevPath() === path) {
        const onPop = () => {
          window.removeEventListener("popstate", onPop);
          router.refresh();
        };
        window.addEventListener("popstate", onPop);
        router.back();
      } else {
        router.replace(target);
      }
    },
    [router],
  );
}
