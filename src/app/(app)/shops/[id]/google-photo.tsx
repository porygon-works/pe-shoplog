"use client";

import { useEffect, useState, type ReactNode } from "react";

type Photo = { url: string; authors: { name: string; uri: string | null }[] };

// 同じ店を開き直すたびに Google を呼ばない（使用回数の上限を使い切らない）よう、取得した写真 URL を
// このタブの中で 30 分だけ使い回す。URL は期限付きなので、それより長くは持たない。
const CACHE_MS = 30 * 60 * 1000;
const cacheKey = (placeId: string) => `pe-gphoto:${placeId}`;

function readCache(placeId: string): Photo | null | undefined {
  try {
    const raw = sessionStorage.getItem(cacheKey(placeId));
    if (!raw) return undefined;
    const { at, photo } = JSON.parse(raw) as { at: number; photo: Photo | null };
    if (Date.now() - at > CACHE_MS) return undefined;
    return photo;
  } catch {
    return undefined;
  }
}

function writeCache(placeId: string, photo: Photo | null | undefined) {
  try {
    if (photo === undefined) sessionStorage.removeItem(cacheKey(placeId));
    else sessionStorage.setItem(cacheKey(placeId), JSON.stringify({ at: Date.now(), photo }));
  } catch {
    // 使えなければ毎回取得する
  }
}

/**
 * ユーザーの写真がない店に、Google の写真を 1 枚だけ出す。表示のたびに取得し、何も保存しない。
 * 失敗したときや写真がないときは fallback を出す。読み込み中は同じ高さの枠を出して画面がずれないようにする。
 */
export function GooglePhoto({ placeId, fallback }: { placeId: string; fallback: ReactNode }) {
  const [photo, setPhoto] = useState<Photo | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    const cached = readCache(placeId);
    if (cached !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage は描画後にしか読めない
      setPhoto(cached);
      return;
    }
    fetch(`/api/places/photo?id=${encodeURIComponent(placeId)}`)
      .then(async (r) => {
        if (!r.ok) return { ok: false as const, photo: null };
        const d = (await r.json()) as { photo?: Photo | null };
        return { ok: true as const, photo: d?.photo?.url ? d.photo : null };
      })
      .then(({ ok, photo: p }) => {
        // 「写真がない」は覚えておく。上限・失敗は覚えず、次に開いたときにもう一度試す。
        if (ok) writeCache(placeId, p);
        if (!cancelled) setPhoto(p);
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
      <img
        src={photo.url}
        alt="Google の写真"
        loading="lazy"
        onError={() => {
          // URL の期限切れなど。覚えた URL を捨てて、代わりの表示にする。
          writeCache(placeId, undefined);
          setPhoto(null);
        }} className="h-full w-full bg-surface-2 object-cover" />
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
