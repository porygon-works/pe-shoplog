import type { Metadata } from "next";
import { Dela_Gothic_One, Zen_Kaku_Gothic_New } from "next/font/google";
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${zen.variable} ${dela.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
