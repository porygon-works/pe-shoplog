"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import type { Category, CategoryKind } from "@/lib/category-utils";
import { addCategoryAction, moveCategoryAction, renameCategoryAction, setCategoryHiddenAction } from "./actions";

export type CategoryItem = Category & { count: number };

type Out = { ok: true } | { error: string };

const link = "bg-transparent p-0 text-xs text-ai disabled:opacity-40";

/** Server Action を呼んで、失敗はトースト、成功は画面を更新する。 */
function useRun() {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<Out>, done?: string): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fn();
      if ("error" in res) {
        toast.show(res.error, "error");
        return false;
      }
      if (done) toast.show(done);
      router.refresh();
      return true;
    } catch (e) {
      console.error("category action failed", e);
      toast.show("処理に失敗しました。時間をおいてもう一度お試しください", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

function CategoryRow({
  kind,
  item,
  first,
  last,
}: {
  kind: CategoryKind;
  item: CategoryItem;
  first: boolean;
  last: boolean;
}) {
  const { busy, run } = useRun();
  const [label, setLabel] = useState(item.label);
  // 「不明」は未選択時の既定値なので隠せない。
  const canHide = !(kind === "genre" && item.value === "unknown");
  const changed = label.trim() !== item.label;

  return (
    <li
      className="flex flex-col gap-1.5 rounded-[14px] border border-line p-3"
      data-testid="category-row"
      data-value={item.value}
    >
      <div className="flex items-center gap-2">
        <input
          className="input min-w-0 flex-1"
          aria-label={`${item.label}の表示名`}
          value={label}
          maxLength={20}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          type="button"
          className="btn !px-3 !py-1.5 text-xs"
          disabled={busy || !changed || label.trim() === ""}
          onClick={() => void run(() => renameCategoryAction(kind, item.value, label), "保存しました")}
        >
          保存
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-xs text-muted">{item.count}店</span>
        {item.hidden && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">非表示</span>}
        <button
          type="button"
          className={`${link} ml-auto`}
          aria-label={`${item.label}を上へ`}
          disabled={busy || first}
          onClick={() => void run(() => moveCategoryAction(kind, item.value, "up"))}
        >
          ↑
        </button>
        <button
          type="button"
          className={link}
          aria-label={`${item.label}を下へ`}
          disabled={busy || last}
          onClick={() => void run(() => moveCategoryAction(kind, item.value, "down"))}
        >
          ↓
        </button>
        {canHide ? (
          <button
            type="button"
            className={link}
            disabled={busy}
            onClick={() =>
              void run(
                () => setCategoryHiddenAction(kind, item.value, !item.hidden),
                item.hidden ? "表示にしました" : "非表示にしました",
              )
            }
          >
            {item.hidden ? "表示する" : "非表示にする"}
          </button>
        ) : (
          <span className="text-xs text-muted">隠せません</span>
        )}
      </div>
    </li>
  );
}

export function CategorySection({ kind, title, items }: { kind: CategoryKind; title: string; items: CategoryItem[] }) {
  const { busy, run } = useRun();
  const [label, setLabel] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => addCategoryAction(kind, label), "追加しました")) setLabel("");
  }

  return (
    <section className="flex flex-col gap-2" data-testid={`category-section-${kind}`}>
      <h2 className="m-0 flex justify-between text-[13px] font-bold text-muted">
        <span>{title}</span>
        <span>{items.length}件</span>
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((item, i) => (
          <CategoryRow key={item.value} kind={kind} item={item} first={i === 0} last={i === items.length - 1} />
        ))}
      </ul>
      <form onSubmit={(e) => void add(e)} className="flex items-center gap-2">
        <input
          className="input min-w-0 flex-1"
          aria-label={`${title}の表示名を追加`}
          placeholder="新しい表示名"
          value={label}
          maxLength={20}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button type="submit" className="btn btn-primary !px-3 !py-1.5 text-xs" disabled={busy || label.trim() === ""}>
          追加
        </button>
      </form>
    </section>
  );
}
