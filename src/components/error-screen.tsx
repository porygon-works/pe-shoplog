"use client";

import Link from "next/link";

export function ErrorScreen({
  digest,
  retry,
}: {
  digest?: string;
  retry: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-bold">うまく表示できませんでした</h1>
      <p className="text-sm text-muted">
        しばらくしてからもう一度お試しください。直らないときは管理者に伝えてください。
      </p>
      {digest && (
        <p className="text-xs text-muted">
          エラーコード: <code>{digest}</code>
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" onClick={() => retry()}>
          もう一度試す
        </button>
        <Link href="/map" className="btn">
          マップへ
        </Link>
      </div>
    </main>
  );
}
