// 使い方: npm run set-passphrase -- <合言葉>
// 環境変数 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY が必要（.env.local を読み込む）。
import { createClient } from "@supabase/supabase-js";
import { hashPassphrase } from "../src/lib/auth/passphrase";

async function main() {
  const passphrase = process.argv[2];
  if (!passphrase?.trim()) {
    console.error("使い方: npm run set-passphrase -- <合言葉>");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY を設定してください");
    process.exit(1);
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin
    .from("app_settings")
    .upsert({ key: "signup_passphrase_hash", value: await hashPassphrase(passphrase) });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log("合言葉を更新しました");
}

void main();
