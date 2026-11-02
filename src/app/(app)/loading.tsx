/**
 * 画面を切り替えた直後に出す骨組み。これがあると、タップした瞬間に画面が切り替わり、
 * リンクの事前読み込みもここまで行われる（サーバーの処理を待って固まって見えるのを防ぐ）。
 */
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="読み込み中" className="flex flex-1 flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="h-5 w-32 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="h-10 animate-pulse rounded-[10px] bg-surface-2" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 rounded-[14px] border border-line p-3">
            <div className="h-[72px] w-[72px] flex-none animate-pulse rounded-[10px] bg-surface-2" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
