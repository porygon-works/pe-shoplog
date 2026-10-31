"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-bold">うまく表示できませんでした</h1>
      <p className="text-sm text-muted">
        しばらくしてからもう一度お試しください。直らないときは管理者に伝えてください。
      </p>
      {error.digest && (
        <p className="text-xs text-muted">
          エラーコード: <code>{error.digest}</code>
        </p>
      )}
      <button type="button" className="btn btn-primary" onClick={reset}>
        もう一度試す
      </button>
    </main>
  );
}
