import type { Metadata, Viewport } from "next";
import { Dela_Gothic_One, Zen_Kaku_Gothic_New } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { SwRegister } from "@/components/sw-register";
import { IllustrationDefs } from "@/components/shop-illustration";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const zen = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-zen",
});
const dela = Dela_Gothic_One({
  weight: "400",
  display: "swap",
  variable: "--font-dela",
});

export const metadata: Metadata = {
  title: { default: "ぺーろぐ", template: "%s | ぺーろぐ" },
  description: "社内向けのお店の記録アプリ",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "ぺーろぐ", statusBarStyle: "default" },
};

// ピンチズームは禁止しない（userScalable / maximumScale は設定しない）。
// viewport-fit=cover にしない: iOS 26 のホーム画面アプリでは、画面がステータスバーの裏まで広がると
// その下 40pt ほどにぼかしがかかり、ヘッダーが曇る。cover なしならステータスバーの下から描画される。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d7263d" },
    { media: "(prefers-color-scheme: dark)", color: "#161112" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${zen.variable} ${dela.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* 保存された「画面の明るさ」を描画前に反映する（data-theme を書き換えるので html は suppressHydrationWarning）。 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="ios-status-band" aria-hidden="true" />
        <IllustrationDefs />
        <NuqsAdapter>{children}</NuqsAdapter>
        <SwRegister />
      </body>
    </html>
  );
}
