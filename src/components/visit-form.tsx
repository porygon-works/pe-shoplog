"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChipGroup } from "@/components/chip-group";
import { PhotoUploader, type ExistingPhoto, type UploadSummary } from "@/components/photo-uploader";
import { PAYMENT_METHODS, PRICE_RANGES, PURPOSES, RESERVATIONS, SMOKING } from "@/lib/options";
import { createVisitAction, updateVisitAction } from "@/lib/visits/actions";
import type { VisitInput } from "@/lib/validation";

export type VisitFormInitial = Pick<
  VisitInput,
  "visitedOn" | "smoking" | "priceRange" | "purpose" | "reservation" | "paymentMethods" | "comment"
> & { partySize: string };

const label = "text-[13px] font-bold text-muted";

export function VisitForm({
  shopId,
  shopName,
  visitId: editingId = null,
  initial,
  existingPhotos = [],
}: {
  shopId: string;
  shopName: string;
  /** 編集のときだけ渡す。 */
  visitId?: string | null;
  initial: VisitFormInitial;
  existingPhotos?: ExistingPhoto[];
}) {
  const router = useRouter();
  const [visitedOn, setVisitedOn] = useState(initial.visitedOn);
  const [smoking, setSmoking] = useState(initial.smoking);
  const [priceRange, setPriceRange] = useState(initial.priceRange);
  const [purpose, setPurpose] = useState(initial.purpose);
  const [reservation, setReservation] = useState(initial.reservation);
  const [paymentMethods, setPaymentMethods] = useState(initial.paymentMethods);
  const [partySize, setPartySize] = useState(initial.partySize);
  const [comment, setComment] = useState(initial.comment);

  // 記録本体を先に保存し、その visitId で写真を送る（2 段階）
  const [visitId, setVisitId] = useState<string | null>(editingId);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UploadSummary>({ pending: 0, failed: 0, done: 0 });
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = editingId !== null;

  useEffect(() => {
    if (saved && summary.pending === 0 && summary.failed === 0) {
      router.push(`/shops/${shopId}`);
    }
  }, [saved, summary, router, shopId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || saved) return;
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const res = isEdit ? await updateVisitAction(editingId, fd) : await createVisitAction(shopId, fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      if ("visitId" in res) setVisitId(res.visitId);
      setSaved(true);
    } catch (err) {
      console.error("save visit failed", err);
      setError("保存に失敗しました。時間をおいてもう一度お試しください");
    } finally {
      setSaving(false);
    }
  }

  const waiting = saved && (summary.pending > 0 || summary.failed > 0);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4 p-4">
      <div>
        <div className="font-bold">{shopName}</div>
        <div className="text-xs text-muted">選ばなかった項目は「不明」として保存されます。</div>
      </div>

      {error && (
        <p role="alert" className="m-0 rounded-[10px] bg-surface-2 p-3 text-[13px] text-shu">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="vd" className={label}>
          行った日
        </label>
        <input
          id="vd"
          name="visitedOn"
          type="date"
          className="input"
          value={visitedOn}
          onChange={(e) => setVisitedOn(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>喫煙（行ったときの状況）</span>
        <ChipGroup name="smoking" options={SMOKING} value={smoking} onChange={setSmoking} aria-label="喫煙" />
      </div>
      <div className="flex flex-col gap-2">
        <span className={label}>値段感（1人あたり）</span>
        <ChipGroup name="priceRange" options={PRICE_RANGES} value={priceRange} onChange={setPriceRange} aria-label="値段感" />
      </div>
      <div className="flex flex-col gap-2">
        <span className={label}>用途（実際に使ったもの）</span>
        <ChipGroup name="purpose" options={PURPOSES} value={purpose} onChange={setPurpose} aria-label="用途" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="ps" className={label}>
          人数
        </label>
        <input
          id="ps"
          name="partySize"
          className="input max-w-40"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="何人で行ったか（任意）"
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>予約</span>
        <ChipGroup name="reservation" options={RESERVATIONS} value={reservation} onChange={setReservation} aria-label="予約" />
      </div>
      <div className="flex flex-col gap-2">
        <span className={label}>支払い方法（複数可）</span>
        <ChipGroup
          name="paymentMethods"
          multiple
          options={PAYMENT_METHODS}
          value={paymentMethods}
          onChange={setPaymentMethods}
          aria-label="支払い方法"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="cm" className={label}>
          コメント
        </label>
        <textarea
          id="cm"
          name="comment"
          className="input min-h-24"
          maxLength={1000}
          placeholder="おすすめの料理、いまいちだった点など（1,000文字まで）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>写真（10枚まで）</span>
        <PhotoUploader visitId={visitId} shopId={shopId} existing={existingPhotos} onStatusChange={setSummary} />
      </div>

      {!saved ? (
        <button type="submit" className="btn btn-accent" disabled={saving}>
          {saving ? "保存しています…" : "記録を保存"}
        </button>
      ) : waiting ? (
        <div className="flex flex-col gap-2">
          <p role="status" className="m-0 text-[13px] text-muted">
            {summary.pending > 0
              ? "記録を保存しました。写真を送信しています…"
              : "記録は保存しました。送信できなかった写真があります。再送するか、あきらめて戻れます。"}
          </p>
          <Link href={`/shops/${shopId}`} className="btn">
            写真をあきらめて戻る
          </Link>
        </div>
      ) : null}
    </form>
  );
}
