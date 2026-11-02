"use client";

import { useActionState } from "react";
import { Field, FormError } from "../auth-shell";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-[18px]">
      <input type="hidden" name="next" value={next} />
      <FormError message={state.error} />
      <Field
        id="loginId"
        name="loginId"
        label="ユーザーID"
        placeholder="半角英小文字・数字・記号（. _ -）で3〜20文字"
        autoComplete="username"
        autoCapitalize="none"
        defaultValue={state.loginId}
        required
      />
      <Field
        id="password"
        name="password"
        label="パスワード"
        type="password"
        placeholder="8文字以上"
        autoComplete="current-password"
        required
      />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        ログイン
      </button>
      <p className="m-0 text-xs text-muted">
        パスワードを忘れたら管理者に仮パスワードを発行してもらってください。
      </p>
    </form>
  );
}
