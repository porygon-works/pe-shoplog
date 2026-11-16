"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  updateAnnouncementAction,
  type AnnouncementFormState,
} from "./actions";

const TITLE_MAX = 60;
const BODY_MAX = 2000;

function Fields({ idPrefix, title, body }: { idPrefix: string; title?: string; body?: string }) {
  return (
    <>
      <label htmlFor={`${idPrefix}-title`} className="text-[13px] font-bold text-muted">
        タイトル
      </label>
      <input id={`${idPrefix}-title`} name="title" className="input" defaultValue={title} maxLength={TITLE_MAX} required />
      <label htmlFor={`${idPrefix}-body`} className="text-[13px] font-bold text-muted">
        本文（任意。URL はリンクになります）
      </label>
      <textarea id={`${idPrefix}-body`} name="body" className="input min-h-[120px]" defaultValue={body} maxLength={BODY_MAX} />
    </>
  );
}

/** 新しいお知らせを出す。出すと全員のマイページの鈴に赤い点が付く。 */
export function NewAnnouncementForm() {
  const [state, action, pending] = useActionState<AnnouncementFormState, FormData>(createAnnouncementAction, {});
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const shown = useRef<AnnouncementFormState | null>(null);
  useEffect(() => {
    if (state.ok && shown.current !== state) {
      shown.current = state;
      formRef.current?.reset();
      toast.show("お知らせを出しました");
    }
  }, [state, toast]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 rounded-xl border border-line p-3">
      {state.error && (
        <p role="alert" className="m-0 text-[13px] text-shu">
          {state.error}
        </p>
      )}
      <Fields idPrefix="new" />
      <button type="submit" className="btn btn-primary self-start" disabled={pending}>
        {pending ? "送信中…" : "お知らせを出す"}
      </button>
      <p className="m-0 text-xs text-muted">出すと、全員のマイページの鈴に赤い点が付きます。</p>
    </form>
  );
}

/** 出したお知らせの編集・削除。 */
export function AnnouncementAdminItem({ id, title, body, date }: { id: string; title: string; body: string; date: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<AnnouncementFormState, FormData>(updateAnnouncementAction, {});
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const shown = useRef<AnnouncementFormState | null>(null);
  useEffect(() => {
    if (state.ok && shown.current !== state) {
      shown.current = state;
      setEditing(false);
      toast.show("保存しました");
    }
  }, [state, toast]);

  async function onDelete() {
    if (!(await confirm(`「${title}」を削除しますか？`))) return;
    setBusy(true);
    try {
      const res = await deleteAnnouncementAction(id);
      if (res.error) toast.show(res.error, "error");
      else toast.show("削除しました");
    } catch {
      toast.show("削除に失敗しました。時間をおいてもう一度お試しください", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li data-testid="announcement-admin-item" className="flex flex-col gap-2 rounded-xl border border-line p-3">
      {editing ? (
        <form action={action} className="flex flex-col gap-2">
          {state.error && (
            <p role="alert" className="m-0 text-[13px] text-shu">
              {state.error}
            </p>
          )}
          <input type="hidden" name="id" value={id} />
          <Fields idPrefix={`e-${id}`} title={title} body={body} />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              保存
            </button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              やめる
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-muted">{date}</span>
              <span className="font-bold">{title}</span>
            </div>
            <button type="button" className="btn !px-2.5 !py-1 text-[13px]" onClick={() => setEditing(true)}>
              編集
            </button>
            <button type="button" className="btn !px-2.5 !py-1 text-[13px] !text-shu" disabled={busy} onClick={() => void onDelete()}>
              削除
            </button>
          </div>
          {body && <p className="m-0 line-clamp-3 whitespace-pre-wrap text-[13px] text-muted">{body}</p>}
        </>
      )}
    </li>
  );
}
