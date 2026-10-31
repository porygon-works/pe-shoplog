"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  "aria-hidden": true,
  className: "h-[22px] w-[22px]",
} as const;

const TABS = [
  {
    href: "/map",
    label: "マップ",
    icon: (
      <svg {...stroke}>
        <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
        <path d="M9 4v14M15 6v14" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "さがす",
    icon: (
      <svg {...stroke}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
      </svg>
    ),
  },
  { href: "/new", label: "登録", icon: null },
  {
    href: "/me",
    label: "マイページ",
    icon: (
      <svg {...stroke}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
    ),
  },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="メインメニュー"
      className="sticky bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map((t) => {
        const on = isActive(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 pb-2.5 pt-2 text-[11px] no-underline ${
              on ? "font-bold text-ai" : "text-muted"
            }`}
          >
            {t.icon ?? (
              <span
                aria-hidden="true"
                className="grid h-[26px] w-[34px] place-items-center rounded-[9px] bg-shu text-xl leading-none text-white"
              >
                ＋
              </span>
            )}
            {t.href === "/new" ? <span>登録</span> : t.label}
          </Link>
        );
      })}
    </nav>
  );
}
