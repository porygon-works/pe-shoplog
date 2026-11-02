"use client";

import { ReturnLink } from "@/components/return-link";
import { useReturnTo } from "@/lib/nav/use-return-to";
import { useEffect, useRef, useState } from "react";
import { ChipGroup } from "@/components/chip-group";
import { PhotoUploader, type ExistingPhoto, type UploadSummary } from "@/components/photo-uploader";
import { useCategories } from "@/components/categories-provider";
import { CategoryPicker } from "@/components/category-picker";
import { selectableOptions } from "@/lib/category-utils";
import { PAYMENT_METHODS, PRICE_RANGES, RESERVATIONS } from "@/lib/options";
import { createVisitAction, updateVisitAction } from "@/lib/visits/actions";
import type { VisitInput } from "@/lib/validation";

export type VisitFormInitial = Pick<
  VisitInput,
  "visitedOn" | "rating" | "priceRange" | "purpose" | "reservation" | "paymentMethods" | "comment"
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
  const [visitedOn, setVisitedOn] = useState(initial.visitedOn ?? "");
  const [rating, setRating] = useState<number | null>(initial.rating);
  const [priceRange, setPriceRange] = useState(initial.priceRange);
  const categories = useCategories();
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
  const returnTo = useReturnTo();
  const navigated = useRef(false);
  const isEdit = editingId !== null;

  useEffect(() => {
    // 1 回だけ移動する（2 回「戻る」と、店の詳細のさらに前まで戻ってしまう）。
    if (saved && summary.pending === 0 && summary.failed === 0 && !navigated.current) {
      navigated.current = true;
      returnTo(`/shops/${shopId}`);
    }
  }, [saved, summary, returnTo, shopId]);

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
        <div className="flex items-center gap-2">
          <input
            id="vd"
            name="visitedOn"
            type="date"
            className="input"
            value={visitedOn}
            onChange={(e) => setVisitedOn(e.target.value)}
          />
          {visitedOn !== "" && (
            <button type="button" className="btn flex-none !px-2.5 !py-[7px] text-[13px]" onClick={() => setVisitedOn("")}>
              日付なしにする
            </button>
          )}
        </div>
        {visitedOn === "" && <span className="text-xs text-muted">日付なしで保存されます。</span>}
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>評価（任意）</span>
        <div role="group" aria-label="評価" className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`★${n}`}
              aria-pressed={rating === n}
              // 同じ★をもう一度押すと解除する
              onClick={() => setRating(rating === n ? null : n)}
              className={`border-0 bg-transparent p-0.5 text-[28px] leading-none ${
                rating !== null && n <= rating ? "text-warn" : "text-line"
              }`}
            >
              ★
            </button>
          ))}
        </div>
        <input type="hidden" name="rating" value={rating ?? ""} />
      </div>
      <div className="flex flex-col gap-2">
        <span className={label}>値段感（1人あたり）</span>
        <ChipGroup name="priceRange" options={PRICE_RANGES} value={priceRange} onChange={setPriceRange} aria-label="値段感" />
      </div>
      <div className="flex flex-col gap-2">
        <span className={label}>用途（実際に使ったもの）</span>
        <CategoryPicker
          kind="purpose"
          name="purpose"
          label="用途"
          multiple={false}
          options={selectableOptions(categories.purposes, [initial.purpose])}
          value={purpose}
          onChange={setPurpose}
        />
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
          <ReturnLink href={`/shops/${shopId}`} className="btn">
            写真をあきらめて戻る
          </ReturnLink>
        </div>
      ) : null}
    </form>
  );
}
