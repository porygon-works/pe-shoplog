import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
