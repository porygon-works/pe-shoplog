"use client";

/**
 * Google の検索候補・店の名前と位置を、このタブを開いている間だけ覚えておく（同じ問い合わせで Google を呼ばない）。
 * メモリだけに持ち、保存はしない。再読み込みで消える。
 */
const MAX_ENTRIES = 100;

export function createMemo<V>() {
  const store = new Map<string, V>();
  return {
    get: (key: string) => store.get(key),
    set: (key: string, value: V) => {
      if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
      store.set(key, value);
    },
    clear: () => store.clear(),
  };
}
