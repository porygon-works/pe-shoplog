"use client";

import { useEffect, useRef } from "react";
import { markAnnouncementsReadAction } from "./actions";

/** 一覧を表示したら既読にする（先読みでは既読にしないよう、画面に出たときだけ）。 */
export function MarkAnnouncementsRead() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markAnnouncementsReadAction().catch((e) => console.error("mark read failed", e));
  }, []);
  return null;
}
