/** 文章の中の http(s) の URL をリンクにして出す（それ以外はそのまま。改行も保つ）。 */
export function LinkifiedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"'）」]+)/g);
  return (
    <p className={`m-0 whitespace-pre-wrap break-words ${className ?? ""}`}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all text-ai">
            {p}
          </a>
        ) : (
          p
        ),
      )}
    </p>
  );
}
