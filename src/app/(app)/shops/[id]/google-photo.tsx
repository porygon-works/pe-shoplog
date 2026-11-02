"use client";

import { useEffect, useState, type ReactNode } from "react";

type Photo = { url: string; authors: { name: string; uri: string | null }[] };

/**
 * ユーザーの写真がない店に、Google の写真を 1 枚だけ出す。表示のたびに取得し、何も保存しない。
 * 失敗したときや写真がないときは fallback を出す。読み込み中は同じ高さの枠を出して画面がずれないようにする。
 */
export function GooglePhoto({ placeId, fallback }: { placeId: string; fallback: ReactNode }) {
  const [photo, setPhoto] = useState<Photo | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/places/photo?id=${encodeURIComponent(placeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setPhoto(d?.photo?.url ? d.photo : null);
      })
      .catch(() => {
        if (!cancelled) setPhoto(null);
      });
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  if (photo === "loading") return <div aria-hidden="true" className="h-[190px] bg-surface-2" />;
  if (!photo) return <>{fallback}</>;
  return (
    <figure data-testid="google-photo" className="relative m-0 h-[190px]">
      {/* 外部 URL で、キャッシュ・最適化してはいけない画像なので next/image は使わない。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt="Google の写真" loading="lazy" className="h-full w-full bg-surface-2 object-cover" />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-1.5 pt-4 text-[11px] text-white [&_a]:text-white [&_a]:underline">
        写真: Google
        {photo.authors.map((a, i) => (
          <span key={i}>
            {i === 0 ? "（" : "、"}
            {a.uri ? (
              <a href={a.uri} target="_blank" rel="noopener noreferrer" className="text-ai">
                {a.name}
              </a>
            ) : (
              a.name
            )}
            {i === photo.authors.length - 1 && "）"}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
