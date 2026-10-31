import Link from "next/link";
import type { VisitLogEntry } from "@/lib/lists/queries";

/** 記録の一覧（店名・日付・用途・コメントの冒頭）。店の詳細へ移動できる。 */
export function VisitLogList({ entries }: { entries: VisitLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="m-0 rounded-[10px] bg-surface-2 p-4 text-center text-[13px] text-muted">記録はまだありません</p>;
  }
  return (
    <>
      {entries.map((v) => (
        <Link
          key={v.id}
          href={`/shops/${v.shopId}`}
          className="flex flex-col gap-0.5 rounded-[14px] border border-line bg-surface p-3 text-inherit no-underline hover:border-ai"
        >
          <span className="text-[15px] font-bold">{v.shopName}</span>
          <span className="text-xs text-muted">
            {v.visitedOn}・{v.purposeLabel}
          </span>
          {v.excerpt && <span className="text-xs text-muted">「{v.excerpt}」</span>}
        </Link>
      ))}
    </>
  );
}
