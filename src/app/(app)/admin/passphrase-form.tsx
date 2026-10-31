"use client";

import { useState } from "react";
import { MIN_PASSPHRASE_LENGTH } from "@/lib/admin/constants";
import { setPassphraseAction } from "./actions";

/** 新規登録の合言葉を変更する。現在の合言葉やそのハッシュは表示しない。 */
export function PassphraseForm() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if ([...value.trim()].length < MIN_PASSPHRASE_LENGTH) {
      setError(`合言葉は${MIN_PASSPHRASE_LENGTH}文字以上にしてください`);
      return;
    }
    setBusy(true);
    try {
      const res = await setPassphraseAction(value);
      if ("error" in res) setError(res.error);
      else {
        setValue("");
        setDone(true);
      }
    } catch (err) {
      console.error("setPassphrase failed", err);
      setError("合言葉を変更できませんでした。時間をおいてもう一度お試しください");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-[14px] border border-line p-3">
      <label className="flex flex-col gap-1 text-[13px] font-bold text-muted">
        新しい合言葉
        <input
          className="input font-normal text-ink"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <p className="m-0 text-xs text-muted">大文字・小文字は区別されません。現在の合言葉は表示されません。</p>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-shu">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="m-0 text-[13px] text-ok">
          合言葉を変更しました
        </p>
      )}
      <button type="submit" className="btn" disabled={busy}>
        合言葉を変更
      </button>
    </form>
  );
}
