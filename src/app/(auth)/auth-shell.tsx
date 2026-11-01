import Link from "next/link";

export function AuthShell({
  mode,
  next,
  children,
}: {
  mode: "login" | "signup";
  next: string | undefined;
  children: React.ReactNode;
}) {
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  const tab = (active: boolean) =>
    `rounded-lg px-1 py-[7px] text-center text-[13px] ${
      active ? "bg-surface font-bold text-ink shadow-sm" : "text-muted"
    }`;
  return (
    <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-[18px] bg-surface px-6 py-8 sm:my-6 sm:flex-none sm:rounded-[28px] sm:border sm:border-line">
      <p className="mt-6 font-display text-[30px] leading-tight text-shu">
        ぺーろぐ
      </p>
      <p className="m-0 text-sm text-muted">社内のみんなで作る、お店の記録帳。</p>
      <nav className="grid grid-flow-col auto-cols-fr gap-[3px] rounded-[10px] bg-surface-2 p-[3px]">
        <Link
          href={`/login${q}`}
          className={tab(mode === "login")}
          aria-current={mode === "login" ? "page" : undefined}
        >
          ログイン
        </Link>
        <Link
          href={`/signup${q}`}
          className={tab(mode === "signup")}
          aria-current={mode === "signup" ? "page" : undefined}
        >
          新規登録
        </Link>
      </nav>
      {children}
    </main>
  );
}

export function Field({
  id,
  name,
  label,
  hint,
  error,
  ...input
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-bold text-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...input}
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
      {error && (
        <span id={`${id}-error`} className="text-xs text-shu">
          {error}
        </span>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="m-0 rounded-[10px] bg-shu-soft px-3 py-2 text-[13px] text-shu"
    >
      {message}
    </p>
  );
}
