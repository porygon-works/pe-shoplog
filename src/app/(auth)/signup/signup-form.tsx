"use client";

import { useActionState } from "react";
import { Field, FormError } from "../auth-shell";
import { signupAction, type SignupState } from "./actions";

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(
    signupAction,
    {},
  );
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-[18px]">
      <input type="hidden" name="next" value={next} />
      <FormError message={state.error} />
      <Field
        id="loginId"
        name="loginId"
        label="ユーザーID"
        placeholder="半角英小文字・数字・_ で3〜20文字"
        autoComplete="username"
        autoCapitalize="none"
        defaultValue={state.values?.loginId}
        error={fe.loginId}
        required
      />
      <Field
        id="nickname"
        name="nickname"
        label="ニックネーム"
        placeholder="みんなに表示される名前"
        autoComplete="nickname"
        defaultValue={state.values?.nickname}
        error={fe.nickname}
        required
      />
      <Field
        id="password"
        name="password"
        label="パスワード"
        type="password"
        placeholder="8文字以上"
        autoComplete="new-password"
        error={fe.password}
        required
      />
      <Field
        id="passphrase"
        name="passphrase"
        label="合言葉"
        placeholder="いつもの2文字を入れてね"
        hint="社内の人ならわかるはず。大文字・小文字はどちらでもOK。"
        autoComplete="off"
        error={fe.passphrase}
        required
      />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        登録してはじめる
      </button>
    </form>
  );
}
