"use client";

import { describeError, reportClientError } from "@/lib/log/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageDecodeError, resizeToJpeg } from "@/lib/images/resize";
import { PHOTO_KINDS } from "@/lib/options";
import { createBrowserClient } from "@/lib/supabase/browser";
import { addPhotoAction, deletePhotoAction, updatePhotoKindAction } from "@/lib/visits/actions";

export const MAX_PHOTOS = 10;

export type PhotoStatus = "queued" | "uploading" | "done" | "error";
export type UploadSummary = { pending: number; failed: number; done: number };
export type ExistingPhoto = { id: string; kind: string; url: string };

type Item = {
  key: string;
  file: File;
  status: PhotoStatus;
  kind: string;
  decodeFailed: boolean;
  preview: string | null;
  // 再送時にやり直さないための途中結果
  resized?: { blob: Blob; width: number; height: number };
  path?: string;
  photoId?: string;
};

const tile = "relative aspect-square overflow-hidden rounded-lg bg-surface-2 text-[11px]";

export function PhotoUploader({
  visitId,
  shopId,
  existing = [],
  onStatusChange,
}: {
  /** 記録を保存する前は null。保存されるとアップロードを始める。 */
  visitId: string | null;
  shopId: string;
  existing?: ExistingPhoto[];
  onStatusChange?: (s: UploadSummary) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [saved, setSaved] = useState<ExistingPhoto[]>(existing);
  const [message, setMessage] = useState<string | null>(null);
  const itemsRef = useRef<Item[]>([]);
  const inFlight = useRef(new Set<string>());
  const supabase = useRef<ReturnType<typeof createBrowserClient> | null>(null);

  const patch = useCallback((key: string, p: Partial<Item>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));
  }, []);

  // 非同期処理から最新の状態を読むための写し（描画後に同期する）
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const run = useCallback(
    async (key: string) => {
      if (!visitId || inFlight.current.has(key)) return;
      inFlight.current.add(key);
      try {
        // 状態更新を effect の外（次のマイクロタスク）で行う
        await Promise.resolve();
        const cur = () => itemsRef.current.find((i) => i.key === key);
        const item = cur();
        if (!item) return;
        patch(key, { status: "uploading" });

        let resized = item.resized;
        if (!resized) {
          try {
            resized = await resizeToJpeg(item.file);
          } catch (e) {
            reportClientError("photo_resize_failed", { visitId, type: item.file.type, size: item.file.size, ...describeError(e) });
            patch(key, { status: "error", decodeFailed: e instanceof ImageDecodeError });
            return;
          }
          patch(key, { resized, preview: URL.createObjectURL(resized.blob) });
        }

        let path = item.path;
        if (!path) {
          path = `shops/${shopId}/visits/${visitId}/${crypto.randomUUID()}.jpg`;
          supabase.current ??= createBrowserClient();
          const { error } = await supabase.current.storage
            .from("photos")
            .upload(path, resized.blob, { contentType: "image/jpeg" });
          if (error) {
            reportClientError("photo_upload_failed", { visitId, message: error.message });
            patch(key, { status: "error" });
            return;
          }
          patch(key, { path });
        }

        const res = await addPhotoAction({
          visitId,
          shopId,
          kind: cur()?.kind ?? "other",
          storagePath: path,
          width: resized.width,
          height: resized.height,
        });
        if ("error" in res) {
          setMessage(res.error);
          patch(key, { status: "error" });
          return;
        }
        patch(key, { status: "done", photoId: res.photoId });
      } catch (e) {
        console.error("photo upload failed", e);
        reportClientError("photo_upload_failed", { visitId, ...describeError(e) });
        patch(key, { status: "error" });
      } finally {
        inFlight.current.delete(key);
      }
    },
    [visitId, shopId, patch],
  );

  // 1 枚ずつ順番に送る
  useEffect(() => {
    if (!visitId) return;
    if (items.some((i) => i.status === "uploading")) return;
    const next = items.find((i) => i.status === "queued");
    // run は非同期で外部（ネットワーク）と同期する処理で、状態更新は最初の await の後に行う
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next) void run(next.key);
  }, [items, visitId, run]);

  useEffect(() => {
    onStatusChange?.({
      pending: items.filter((i) => i.status === "queued" || i.status === "uploading").length,
      failed: items.filter((i) => i.status === "error").length,
      done: items.filter((i) => i.status === "done").length,
    });
  }, [items, onStatusChange]);

  useEffect(() => {
    return () => {
      for (const i of itemsRef.current) if (i.preview) URL.revokeObjectURL(i.preview);
    };
  }, []);

  const total = saved.length + items.length;
  const full = total >= MAX_PHOTOS;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_PHOTOS - total;
    const accepted = files.slice(0, Math.max(0, room));
    setMessage(files.length > accepted.length ? `写真は10枚までです（${files.length - accepted.length}枚は追加されませんでした）` : null);
    if (accepted.length === 0) return;
    const added: Item[] = accepted.map((file) => ({
      key: crypto.randomUUID(),
      file,
      status: "queued",
      kind: "other",
      decodeFailed: false,
      preview: null,
    }));
    setItems((prev) => [...prev, ...added]);
  }

  function retry(key: string) {
    patch(key, { status: "queued" });
  }

  function discard(key: string) {
    const i = items.find((x) => x.key === key);
    if (i?.preview) URL.revokeObjectURL(i.preview);
    setItems((prev) => prev.filter((x) => x.key !== key));
  }

  async function changeKind(item: Item, kind: string) {
    patch(item.key, { kind });
    if (item.status === "done" && item.photoId) {
      const res = await updatePhotoKindAction(item.photoId, kind);
      if ("error" in res) setMessage(res.error);
    }
  }

  async function removeDone(item: Item) {
    if (!item.photoId) return;
    const res = await deletePhotoAction(item.photoId);
    if ("error" in res) setMessage(res.error);
    else discard(item.key);
  }

  async function removeSaved(p: ExistingPhoto) {
    const res = await deletePhotoAction(p.id);
    if ("error" in res) setMessage(res.error);
    else setSaved((s) => s.filter((x) => x.id !== p.id));
  }

  const kindSelect = (value: string, onChange: (k: string) => void) => (
    <select
      aria-label="写真の種類"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="absolute inset-x-0 bottom-0 w-full bg-[rgba(10,15,25,.55)] px-1 py-0.5 text-[11px] text-white"
    >
      {PHOTO_KINDS.map((k) => (
        <option key={k.value} value={k.value} className="text-ink">
          {k.label}
        </option>
      ))}
    </select>
  );

  const removeBtn = (label: string, onClick: () => void) => (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-[rgba(10,15,25,.55)] p-0 text-xs text-white"
    >
      ×
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {saved.map((p) => (
          <div key={p.id} className={tile} data-testid="photo-tile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            {removeBtn("この写真を削除", () => void removeSaved(p))}
            {kindSelect(p.kind, (k) => {
              setSaved((s) => s.map((x) => (x.id === p.id ? { ...x, kind: k } : x)));
              void updatePhotoKindAction(p.id, k).then((r) => {
                if ("error" in r) setMessage(r.error);
              });
            })}
          </div>
        ))}
        {items.map((i) => (
          <div key={i.key} className={tile} data-testid="photo-tile" data-status={i.status}>
            {i.preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.preview} alt="" className="h-full w-full object-cover" />
            )}
            {i.status === "error" ? (
              <div className="absolute inset-0 grid place-content-center justify-items-center gap-1 bg-shu-soft p-1 text-center text-shu">
                {i.decodeFailed ? (
                  <span>この画像は読み込めません</span>
                ) : (
                  <>
                    <span>送信できませんでした</span>
                    <button type="button" className="btn !px-2 !py-1 text-[11px]" onClick={() => retry(i.key)}>
                      再送
                    </button>
                  </>
                )}
                {removeBtn("この写真を取り消す", () => discard(i.key))}
              </div>
            ) : (
              <>
                <span className="absolute left-1 top-1 rounded bg-[rgba(10,15,25,.55)] px-1 text-white">
                  {i.status === "done" ? "送信済み" : i.status === "uploading" ? "送信中…" : "送信待ち"}
                </span>
                {i.status === "done"
                  ? removeBtn("この写真を削除", () => void removeDone(i))
                  : i.status === "queued" && removeBtn("この写真を取り消す", () => discard(i.key))}
                {kindSelect(i.kind, (k) => void changeKind(i, k))}
              </>
            )}
          </div>
        ))}
        {!full && (
          <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border-[1.5px] border-dashed border-line text-xs text-muted">
            ＋ 追加
            <input type="file" accept="image/*" multiple hidden onChange={onPick} aria-label="写真を追加" />
          </label>
        )}
      </div>
      {full && <p className="m-0 text-xs text-muted">写真は10枚までです。</p>}
      {message && (
        <p role="alert" className="m-0 text-xs text-shu">
          {message}
        </p>
      )}
      <span className="text-xs text-muted">
        写真ごとに種類（メニュー・席・料理・外観・その他）を選べます。撮影場所の情報は自動で消えます。
      </span>
    </div>
  );
}
