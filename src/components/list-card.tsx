import Link from "next/link";
import { LIST_KIND_LABEL } from "@/lib/lists/shared";
import type { ListSummary } from "@/lib/lists/queries";

const pill = "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px]";

/** マイリスト 1 件のカード。名前、種類・店数、公開/非公開と既定の印。 */
export function ListCard({ list }: { list: ListSummary }) {
  return (
    <Link
      href={`/lists/${list.id}`}
      data-testid="list-card"
      className="flex flex-col gap-1 rounded-[14px] border border-line bg-surface p-3 text-inherit no-underline hover:border-ai"
    >
      <div className="text-[15px] font-bold">{list.name}</div>
      <div className="text-xs text-muted">
        {LIST_KIND_LABEL[list.kind]}・{list.shopCount}店
      </div>
      <div className="flex flex-wrap gap-1">
        <span className={`${pill} ${list.isPublic ? "bg-ai-soft font-bold text-ai" : "bg-surface-2 text-muted"}`}>
          {list.isPublic ? "公開" : "非公開"}
        </span>
        {list.isDefault && <span className={`${pill} bg-surface-2 text-muted`}>既定</span>}
      </div>
    </Link>
  );
}
