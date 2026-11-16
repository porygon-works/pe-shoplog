/** 未読件数の赤いバッジ。0 件なら何も出さない。 */
export function UnreadBadge({ count, className, testId }: { count: number; className?: string; testId?: string }) {
  if (count <= 0) return null;
  return (
    <span
      data-testid={testId}
      aria-hidden="true"
      className={`grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-surface bg-shu px-1 text-[10px] font-bold leading-none text-white ${className ?? ""}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
