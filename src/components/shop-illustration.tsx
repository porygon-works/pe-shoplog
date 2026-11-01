import type { ReactNode } from "react";

/**
 * 写真のない店の代わりに出すイラスト。ジャンル → 形態 → ジョッキ の順で選ぶ。
 * 線は currentColor（赤）。手描きの揺れは root layout の <filter id="pe-wob"> を使う。
 * 原図: docs/design/2026-11-01-noimage-illustrations.html
 */
const DRAWINGS: Record<string, ReactNode> = {
  washoku: (
    <>
      <path d="M17 36q15-16 30 0" fill="#fff" />
      <path d="M12 36h40q-2 16-20 16t-20-16z" fill="#fff" />
      <path d="M26 52h12" />
      <path d="M40 12l14 18M45 10l12 16" />
    </>
  ),
  sushi_seafood: (
    <>
      <rect x="14" y="34" width="36" height="14" rx="7" fill="#fff" />
      <path d="M10 34q4-12 22-12t24 8q-4 6-12 6H16q-6 0-6-2z" fill="currentColor" fillOpacity=".25" />
      <path d="M24 25l4 8M33 23l3 9M42 25l2 7" />
    </>
  ),
  yakiniku: (
    <>
      <circle cx="32" cy="34" r="20" fill="#fff" />
      <path d="M16 27h32M13 34h38M16 41h32" />
      <rect x="20" y="22" width="12" height="8" rx="3" transform="rotate(-15 26 26)" fill="currentColor" fillOpacity=".3" />
      <rect x="33" y="36" width="12" height="8" rx="3" transform="rotate(12 39 40)" fill="currentColor" fillOpacity=".3" />
      <path d="M24 10q-3 4 0 7M32 8q-3 4 0 7M40 10q-3 4 0 7" />
    </>
  ),
  yakitori: (
    <>
      <path d="M10 54L56 8" />
      <rect x="12" y="34" width="13" height="13" rx="3" transform="rotate(-45 18.5 40.5)" fill="#fff" />
      <rect x="24" y="22" width="13" height="13" rx="3" transform="rotate(-45 30.5 28.5)" fill="currentColor" fillOpacity=".25" />
      <rect x="36" y="10" width="13" height="13" rx="3" transform="rotate(-45 42.5 16.5)" fill="#fff" />
    </>
  ),
  nabe: (
    <>
      <path d="M12 32h40v8q0 12-20 12T12 40z" fill="#fff" />
      <path d="M8 34h4M52 34h4" />
      <path d="M14 32q18-14 36 0" fill="currentColor" fillOpacity=".2" />
      <path d="M30 22h4" />
      <path d="M22 14q-3-4 0-8M32 14q-3-4 0-8M42 14q-3-4 0-8" />
    </>
  ),
  chinese: (
    <>
      <path d="M8 40q12-20 26 0z" fill="#fff" />
      <path d="M13 32l3 2M19 27l2 3M26 27l1 3" />
      <path d="M30 46q12-20 26 0z" fill="#fff" />
      <path d="M35 38l3 2M41 33l2 3M48 33l1 3" />
      <path d="M6 50h52" />
    </>
  ),
  korean: (
    <>
      <path d="M10 30h44q-2 22-22 22T10 30z" fill="currentColor" fillOpacity=".25" />
      <ellipse cx="32" cy="30" rx="22" ry="6" fill="#fff" />
      <circle cx="32" cy="29" r="4" fill="currentColor" fillOpacity=".55" />
      <path d="M18 29l5-2M41 28l5 2" />
    </>
  ),
  asian_ethnic: (
    <>
      <path d="M22 50q-12-14 2-30q8-8 18-6q-2 10-8 16t-12 20z" fill="currentColor" fillOpacity=".3" />
      <path d="M42 14q4-4 8-4M22 50q6-16 18-32" />
      <path d="M40 46a10 10 0 0 0 16-6H40z" fill="#fff" />
      <path d="M48 40l-4 6M48 40l4 5" />
    </>
  ),
  italian: (
    <>
      <path d="M12 16q20-8 40 0L32 56z" fill="#fff" />
      <path d="M12 16q20-8 40 0" />
      <circle cx="26" cy="24" r="3.5" fill="currentColor" fillOpacity=".5" />
      <circle cx="38" cy="25" r="3.5" fill="currentColor" fillOpacity=".5" />
      <circle cx="32" cy="37" r="3.5" fill="currentColor" fillOpacity=".5" />
    </>
  ),
  french_bistro: (
    <>
      <path d="M20 8h24q2 22-12 26Q18 30 20 8z" fill="#fff" />
      <path d="M21 18h22q-1 12-11 14q-10-2-11-14z" fill="currentColor" fillOpacity=".45" />
      <path d="M32 34v16M22 54h20" />
    </>
  ),
  yoshoku: (
    <>
      <ellipse cx="32" cy="42" rx="26" ry="10" fill="#fff" />
      <path d="M14 40q0-18 18-18t18 18z" fill="currentColor" fillOpacity=".2" />
      <path d="M20 32l4-3 4 3 4-3 4 3 4-3 4 3" />
    </>
  ),
  ramen: (
    <>
      <path d="M8 30h48q-2 22-24 22T8 30z" fill="#fff" />
      <path d="M14 36q6 4 12 0t12 0 12 0" />
      <circle cx="40" cy="30" r="5" fill="#fff" />
      <path d="M38 30q2-2 4 0" />
      <path d="M30 6l6 24M38 6l2 24" />
    </>
  ),
  curry: (
    <>
      <ellipse cx="32" cy="38" rx="27" ry="13" fill="#fff" />
      <path d="M32 26q-16 0-20 10q6 10 20 10z" fill="#fff" />
      <path d="M32 26q16 0 20 10q-6 10-20 10z" fill="currentColor" fillOpacity=".3" />
      <path d="M44 18l8-10" />
    </>
  ),
  cafe: (
    <>
      <path d="M14 26h30v12q0 12-15 12T14 38z" fill="#fff" />
      <path d="M44 30h4a6 6 0 0 1 0 12h-5" />
      <path d="M10 54h38" />
      <path d="M22 18q-3-4 0-8M30 18q-3-4 0-8M38 18q-3-4 0-8" />
    </>
  ),
  lantern: (
    <>
      <path d="M24 10h16M24 54h16" />
      <ellipse cx="32" cy="32" rx="16" ry="20" fill="currentColor" fillOpacity=".35" />
      <path d="M17 24h30M16 32h32M17 40h30" />
      <path d="M32 54v6" />
    </>
  ),
  bar: (
    <>
      <path d="M12 12h40L32 34z" fill="#fff" />
      <path d="M18 18h28L32 30z" fill="currentColor" fillOpacity=".35" />
      <path d="M32 34v16M22 54h20" />
      <circle cx="44" cy="10" r="4" fill="#fff" />
    </>
  ),
  jokki: (
    <>
      <rect x="14" y="18" width="28" height="38" rx="4" fill="currentColor" fillOpacity=".3" />
      <path d="M42 26h5a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6h-5" />
      <path d="M12 20q0-8 8-7q3-6 10-3q6-4 11 1q8-1 8 8z" fill="#fff" />
      <path d="M22 28v20M34 28v20" />
    </>
  ),
};

const LANTERN_STYLES = ["izakaya", "taishu_izakaya", "tachinomi", "private_room"];
const BAR_STYLES = ["bar", "dining_bar"];

export function illustrationKey(genre: string, styles: readonly string[]): string {
  if (genre !== "unknown" && genre !== "other" && genre in DRAWINGS) return genre;
  if (styles.some((s) => LANTERN_STYLES.includes(s))) return "lantern";
  if (styles.some((s) => BAR_STYLES.includes(s))) return "bar";
  return "jokki";
}

/** 手描きの揺れ。root layout に 1 回だけ置く。 */
export function IllustrationDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <filter id="pe-wob" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves={2} seed={5} />
        <feDisplacementMap in="SourceGraphic" scale={1.4} />
      </filter>
    </svg>
  );
}

export function ShopIllustration({
  genre,
  styles,
  className,
}: {
  genre: string;
  styles: readonly string[];
  className?: string;
}) {
  const key = illustrationKey(genre, styles);
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className} data-illustration={key}>
      <g
        filter="url(#pe-wob)"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {DRAWINGS[key]}
      </g>
    </svg>
  );
}
