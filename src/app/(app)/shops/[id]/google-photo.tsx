"use client";

import { useEffect, useState } from "react";

type Photo = { url: string; authors: { name: string; uri: string | null }[] };

/**
 * ユーザーの写真がない店に、Google の写真を 1 枚だけ出す。表示のたびに取得し、何も保存しない。
 * 失敗したときや写真がないときは何も出さない。
 */
export function GooglePhoto({ placeId }: { placeId: string }) {
  const [photo, setPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/places/photo?id=${encodeURIComponent(placeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.photo?.url) setPhoto(d.photo);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  if (!photo) return null;
  return (
    <figure data-testid="google-photo" className="m-0 flex flex-col gap-1">
      {/* 外部 URL で、キャッシュ・最適化してはいけない画像なので next/image は使わない。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt="Google の写真" loading="lazy" className="h-[190px] w-full bg-surface-2 object-cover" />
      <figcaption className="px-4 text-[11px] text-muted">
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
