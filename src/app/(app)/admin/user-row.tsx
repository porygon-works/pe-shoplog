"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import {
  deleteUserAction,
  disableUserAction,
  enableUserAction,
  grantAdminAction,
  issueTempPasswordAction,
} from "./actions";

export type AdminUser = {
  id: string;
  loginId: string;
  nickname: string;
  isAdmin: boolean;
  disabled: boolean;
  createdOn: string;
  isSelf: boolean;
};

const badge = "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px]";
const link = "bg-transparent p-0 text-xs text-ai";

export function UserRow({ user }: { user: AdminUser }) {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: true } | { error: string }>, done: string) {
    setBusy(true);
    try {
      const res = await fn();
      if ("error" in res) toast.show(res.error, "error");
      else {
        toast.show(done);
        router.refresh();
      }
    } catch (e) {
      console.error("admin action failed", e);
      toast.show("処理に失敗しました。時間をおいてもう一度お試しください", "error");
    } finally {
      setBusy(false);
    }
  }

  async function issue() {
    if (!(await confirm(`${user.nickname}さんの仮パスワードを発行しますか？今のパスワードは使えなくなります。`)))
      return;
    setBusy(true);
    try {
      const res = await issueTempPasswordAction(user.id);
      if ("error" in res) toast.show(res.error, "error");
      else setTempPassword(res.tempPassword);
    } catch (e) {
      console.error("issueTempPassword failed", e);
      toast.show("処理に失敗しました。時間をおいてもう一度お試しください", "error");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.show("コピーしました");
    } catch {
      toast.show("コピーできませんでした。手で選択してコピーしてください", "error");
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-[14px] border border-line p-3" data-testid="admin-user">
      <div className="flex flex-wrap items-center gap-1.5">
        <b className="text-[15px]">{user.nickname}</b>
        <span className="text-xs text-muted">@{user.loginId}</span>
        {user.isAdmin && <span className={`${badge} bg-ai-soft font-bold text-ai`}>管理者</span>}
        {user.disabled && <span className={`${badge} bg-warn-soft text-warn`}>停止中</span>}
        <span className="ml-auto text-xs text-muted">{user.createdOn} 登録</span>
      </div>

      {tempPassword && (
        <div className="flex flex-col gap-1.5 rounded-[10px] bg-surface-2 p-2.5" role="status">
          <span className="text-xs text-muted">仮パスワード（本人に伝えてください）</span>
          <div className="flex items-center gap-2">
            <code data-testid="temp-password" className="select-all text-base font-bold tracking-wider">
              {tempPassword}
            </code>
            <button type="button" className="btn !px-2.5 !py-1 text-xs" onClick={() => void copy()}>
              コピー
            </button>
          </div>
          <span className="text-xs text-shu">この画面を閉じると再表示できません</span>
          <button type="button" className={`${link} self-start`} onClick={() => setTempPassword(null)}>
            閉じる
          </button>
        </div>
      )}

      {user.isSelf ? (
        <p className="m-0 text-xs text-muted">自分のアカウントはここでは変更できません</p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <button type="button" disabled={busy} className={link} onClick={() => void issue()}>
            仮パスワードを発行
          </button>
          {user.disabled ? (
            <button
              type="button"
              disabled={busy}
              className={link}
              onClick={() => void run(() => enableUserAction(user.id), "利用を再開しました")}
            >
              再開
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              className={link}
              onClick={async () => {
                if (await confirm(`${user.nickname}さんを停止しますか？ログインできなくなります。`))
                  await run(() => disableUserAction(user.id), "停止しました");
              }}
            >
              停止
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            className={link}
            onClick={async () => {
              const msg = user.isAdmin
                ? `${user.nickname}さんの管理者権限を外しますか？`
                : `${user.nickname}さんを管理者にしますか？`;
              if (await confirm(msg))
                await run(
                  () => grantAdminAction(user.id, !user.isAdmin),
                  user.isAdmin ? "管理者権限を外しました" : "管理者にしました",
                );
            }}
          >
            {user.isAdmin ? "管理者を外す" : "管理者にする"}
          </button>
          <button
            type="button"
            disabled={busy}
            className="bg-transparent p-0 text-xs text-shu"
            onClick={async () => {
              if (
                await confirm(
                  `${user.nickname}さんを削除しますか？この操作は取り消せません。投稿は「退会したユーザー」として残ります。`,
                )
              )
                await run(() => deleteUserAction(user.id), "ユーザーを削除しました");
            }}
          >
            削除
          </button>
        </div>
      )}
    </li>
  );
}
