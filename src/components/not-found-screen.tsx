import Link from "next/link";

export function NotFoundScreen() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-bold">ページが見つかりません</h1>
      <p className="text-sm text-muted">
        削除されたか、見る権限がない可能性があります。
      </p>
      <Link href="/map" className="btn btn-primary">
        マップへ
      </Link>
    </main>
  );
}
