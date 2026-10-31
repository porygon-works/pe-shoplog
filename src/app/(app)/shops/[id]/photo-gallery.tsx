"use client";

import { useState } from "react";
import { PHOTO_KINDS } from "@/lib/options";

export type GalleryPhoto = { id: string; kind: string; url: string };

export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [kind, setKind] = useState<string>("all");
  const shown = kind === "all" ? photos : photos.filter((p) => p.kind === kind);
  const tabs = [
    { value: "all", label: "すべて" },
    ...PHOTO_KINDS.filter((k) => photos.some((p) => p.kind === k.value)),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="写真の種類" className="flex flex-nowrap gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={kind === t.value}
            onClick={() => setKind(t.value)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] ${
              kind === t.value
                ? "border-ai bg-ai text-white dark:text-[#0f131b]"
                : "border-line bg-surface text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {shown.map((p) => (
          // 署名付き URL の画像なので next/image の最適化は使わない。
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={p.url}
            alt={`${PHOTO_KINDS.find((k) => k.value === p.kind)?.label ?? "写真"}の写真`}
            loading="lazy"
            className="aspect-square w-full rounded-lg bg-surface-2 object-cover"
          />
        ))}
      </div>
    </div>
  );
}
