"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deletePhotoAction } from "@/app/(app)/admin/actions";
import { useConfirm } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { PHOTO_KINDS } from "@/lib/options";

export type GalleryPhoto = { id: string; kind: string; url: string };

export function PhotoGallery({ photos, isAdmin = false }: { photos: GalleryPhoto[]; isAdmin?: boolean }) {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onDelete(photoId: string) {
    if (!(await confirm("この写真を削除しますか？（管理者）"))) return;
    setBusyId(photoId);
    try {
      const res = await deletePhotoAction(photoId);
      if ("error" in res) toast.show(res.error, "error");
      else {
        toast.show("写真を削除しました");
        router.refresh();
      }
    } catch (e) {
      console.error("deletePhoto (admin) failed", e);
      toast.show("削除に失敗しました。時間をおいてもう一度お試しください", "error");
    } finally {
      setBusyId(null);
    }
  }

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
                ? "border-ai bg-ai text-white dark:text-[#161112]"
                : "border-line bg-surface text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {shown.map((p) => (
          <div key={p.id} className="relative">
            {/* 署名付き URL の画像なので next/image の最適化は使わない。 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={`${PHOTO_KINDS.find((k) => k.value === p.kind)?.label ?? "写真"}の写真`}
              loading="lazy"
              className="aspect-square w-full rounded-lg bg-surface-2 object-cover"
            />
            {isAdmin && (
              <button
                type="button"
                disabled={busyId === p.id}
                onClick={() => void onDelete(p.id)}
                className="absolute right-1 bottom-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white"
              >
                削除（管理者）
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
