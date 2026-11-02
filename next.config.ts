import type { NextConfig } from "next";

/**
 * すべての応答に付けるセキュリティヘッダー。地図（Google Maps）を壊さないよう、読み込み元を絞る CSP の
 * script-src などは付けず、クリックジャッキング・MIME の取り違え・外部へのフォーム送信などを防ぐものに絞る。
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  experimental: {
    // 一度開いた画面を 30 秒だけブラウザに覚えておき、タブの行き来をすぐ表示する。
    // 登録・編集の Server Action は revalidatePath で更新するので、操作後は最新になる。
    staleTimes: { dynamic: 30 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
