"use client";

import { useEffect } from "react";

const KEY = "pe-scroll";
const MAX_WAIT_MS = 3000;
const MAX_ENTRIES = 50;

type Store = Record<string, number>;
const urlKey = () => location.pathname + location.search;

function readStore(): Store {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function writeY(key: string, y: number) {
  try {
    const s = readStore();
    delete s[key];
    s[key] = Math.round(y);
    const keys = Object.keys(s);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete s[k];
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 使えなければ位置は戻さない
  }
}

/**
 * 「戻る」で前の画面に戻ったとき、その画面で見ていたスクロール位置に戻す。
 * ブラウザ任せだと、一覧の読み込みが終わる前（骨組みだけの短い画面）で位置を戻そうとして、
 * 何もない所までスクロールして背景しか見えなくなる（iPhone では触るまで描き直されない）。
 * そこで位置の復元はアプリで行い、内容が読み込まれて十分な高さになってから戻す。
 */
export function ScrollRestorer() {
  useEffect(() => {
    try {
      history.scrollRestoration = "manual";
    } catch {
      // 対応していなければブラウザ任せ
    }

    let restoring = false;
    let frame = 0;
    let saveFrame = 0;

    const onScroll = () => {
      if (restoring || saveFrame) return;
      saveFrame = requestAnimationFrame(() => {
        saveFrame = 0;
        if (!restoring) writeY(urlKey(), window.scrollY);
      });
    };

    const stop = () => {
      restoring = false;
      cancelAnimationFrame(frame);
    };

    const onPop = () => {
      const target = readStore()[urlKey()] ?? 0;
      cancelAnimationFrame(frame);
      restoring = true;
      // 前の画面の位置のままだと、読み込み中の短い画面で何もない所が見えるので、いったん上へ。
      window.scrollTo(0, 0);
      if (target <= 0) {
        restoring = false;
        return;
      }
      const started = performance.now();
      const tick = () => {
        if (!restoring) return;
        const loading = document.querySelector('main[aria-busy="true"]');
        const room = document.documentElement.scrollHeight - window.innerHeight;
        const timedOut = performance.now() - started > MAX_WAIT_MS;
        if ((!loading && room >= target) || timedOut) {
          window.scrollTo(0, Math.min(target, Math.max(0, room)));
          restoring = false;
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPop);
    // 復元を待っている間にユーザーが自分で動かしたら、そちらを優先する。
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("wheel", stop, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("wheel", stop);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(saveFrame);
    };
  }, []);
  return null;
}
