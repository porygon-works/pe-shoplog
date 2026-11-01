import { execFileSync } from "node:child_process";

const NAMES = {
  NEXT_PUBLIC_SUPABASE_URL: "API_URL",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "PUBLISHABLE_KEY",
  SUPABASE_SECRET_KEY: "SECRET_KEY",
} as const;

/**
 * 環境変数が無ければ、ローカルの `supabase status -o env` から補う。
 * CI では ci.yml が同じ名前でエクスポートする。
 */
export function loadSupabaseEnv(): {
  url: string;
  publishableKey: string;
  secretKey: string;
} {
  const missing = Object.keys(NAMES).filter(
    (k) => !process.env[k],
  ) as (keyof typeof NAMES)[];
  if (missing.length > 0) {
    const out = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed: Record<string, string> = {};
    for (const line of out.split("\n")) {
      const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
      if (m) parsed[m[1]] = m[2];
    }
    for (const k of missing) {
      const v = parsed[NAMES[k]];
      if (!v) throw new Error(`supabase status に ${NAMES[k]} がありません`);
      process.env[k] = v;
    }
  }
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(
      `DB テストはテーブルを書き換えるため、ローカルの Supabase でのみ実行できます（現在の接続先: ${host}）`,
    );
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    secretKey: process.env.SUPABASE_SECRET_KEY!,
  };
}
