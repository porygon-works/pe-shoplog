"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/(auth)/login/actions";
import { useToast } from "@/components/toast";
import { updateNicknameAction } from "@/lib/lists/actions";
import { createBrowserClient } from "@/lib/supabase/browser";

const MIN_PASSWORD = 8;

/** アカウントタブ: ニックネームの変更、パスワードの変更、ログアウト、（管理者のみ）管理画面への入口。 */
export function AccountPanel({ nickname, isAdmin }: { nickname: string; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [nick, setNick] = useState(nickname);
  const [nickBusy, setNickBusy] = useState(false);
  const [nickError, setNickError] = useState<string | null>(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  async function saveNickname() {
    setNickBusy(true);
    setNickError(null);
    try {
      const res = await updateNicknameAction(nick);
      if ("error" in res) {
        setNickError(res.error);
        return;
      }
      toast.show("ニックネームを変更しました");
      router.refresh();
    } catch {
      setNickError("保存に失敗しました。時間をおいてもう一度お試しください");
    } finally {
      setNickBusy(false);
    }
  }

  async function savePassword() {
    setPwError(null);
    if (pw.length < MIN_PASSWORD) {
      setPwError(`パスワードは${MIN_PASSWORD}文字以上にしてください`);
      return;
    }
    if (pw !== pwConfirm) {
      setPwError("確認用のパスワードが一致しません");
      return;
    }
    setPwBusy(true);
    try {
      const { error } = await createBrowserClient().auth.updateUser({ password: pw });
      if (error) {
        console.error("updateUser(password) failed", error);
        setPwError(
          error.code === "same_password"
            ? "今と同じパスワードは使えません"
            : error.code === "weak_password"
              ? "パスワードが弱すぎます"
              : "パスワードを変更できませんでした。時間をおいてもう一度お試しください",
        );
        return;
      }
      setPw("");
      setPwConfirm("");
      setPwOpen(false);
      toast.show("パスワードを変更しました");
    } catch {
      setPwError("パスワードを変更できませんでした。時間をおいてもう一度お試しください");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <label htmlFor="nickname" className="text-[13px] font-bold text-muted">
          ニックネーム
        </label>
        <input
          id="nickname"
          className="input"
          value={nick}
          maxLength={20}
          onChange={(e) => setNick(e.target.value)}
        />
        {nickError && (
          <p role="alert" className="m-0 text-[13px] text-shu">
            {nickError}
          </p>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => void saveNickname()}
          disabled={nickBusy || nick.trim() === "" || nick.trim() === nickname}
        >
          ニックネームを保存
        </button>
      </div>

      {pwOpen ? (
        <div className="flex flex-col gap-2 rounded-[14px] border border-line p-3">
          <label className="flex flex-col gap-1 text-[13px] font-bold text-muted">
            新しいパスワード
            <input
              type="password"
              className="input font-normal text-ink"
              autoComplete="new-password"
              placeholder={`${MIN_PASSWORD}文字以上`}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-bold text-muted">
            新しいパスワード（確認）
            <input
              type="password"
              className="input font-normal text-ink"
              autoComplete="new-password"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
            />
          </label>
          {pwError && (
            <p role="alert" className="m-0 text-[13px] text-shu">
              {pwError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn flex-1 !py-2"
              disabled={pwBusy}
              onClick={() => {
                setPwOpen(false);
                setPwError(null);
              }}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1 !py-2"
              disabled={pwBusy}
              onClick={() => void savePassword()}
            >
              パスワードを更新
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn" onClick={() => setPwOpen(true)}>
          パスワードを変更
        </button>
      )}

      <form action={logoutAction} className="flex flex-col">
        <button type="submit" className="btn">
          ログアウト
        </button>
      </form>

      {isAdmin && (
        <>
          <p className="m-0 mt-2 text-[13px] font-bold text-muted">管理者メニュー</p>
          <Link
            href="/admin"
            className="flex flex-col gap-0.5 rounded-[14px] border border-line bg-surface p-3 text-inherit no-underline hover:border-ai"
          >
            <span className="text-[15px] font-bold">管理画面</span>
            <span className="text-xs text-muted">合言葉の変更、仮パスワードの発行、ユーザーの停止、投稿の削除</span>
          </Link>
        </>
      )}
    </>
  );
}
