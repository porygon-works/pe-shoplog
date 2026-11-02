"use client";

import { useState } from "react";
import { refreshAllLocationsAction } from "./actions";

/** 全店の位置を Google の店の位置に合わせる。地図のピンが Google のアイコンとずれているとき用。 */
export function RefreshLocationsButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await refreshAllLocationsAction();
      setMessage(
        "error" in res
          ? res.error
          : `${res.updated}店の位置を合わせました${res.failed ? `（${res.failed}店は取得できませんでした）` : ""}`,
      );
    } catch {
      setMessage("位置を取り直せませんでした。時間をおいてもう一度お試しください");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-line p-3">
      <p className="m-0 text-xs text-muted">
        地図のピンが Google のお店のアイコンとずれているときに使います。Google マップから登録した店すべての位置を取り直します。
      </p>
      <button type="button" className="btn" disabled={busy} onClick={run}>
        {busy ? "取り直しています…" : "Google の位置に合わせる"}
      </button>
      {message && (
        <p role="status" className="m-0 text-[13px]">
          {message}
        </p>
      )}
    </div>
  );
}
