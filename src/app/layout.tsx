import type { Metadata, Viewport } from "next";
import { Dela_Gothic_One, Zen_Kaku_Gothic_New } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { SwRegister } from "@/components/sw-register";
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
  title: "PE ショップログ",
  description: "社内向けのお店の記録アプリ",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "ショップログ", statusBarStyle: "default" },
};

// ピンチズームは禁止しない（userScalable / maximumScale は設定しない）。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#24407a" },
    { media: "(prefers-color-scheme: dark)", color: "#0f131b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${zen.variable} ${dela.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NuqsAdapter>{children}</NuqsAdapter>
        <SwRegister />
      </body>
    </html>
  );
}
