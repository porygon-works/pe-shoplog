export const AUTH_EMAIL_DOMAIN = "users.pe-shoplog.invalid";

/**
 * 英小文字・数字と記号 . _ - の 3〜20 文字。ダミーのメールアドレスの前半に使うので、
 * 最初と最後は英数字、ドットの連続は不可（メールアドレスとして正しい形にする）。
 */
export const LOGIN_ID_PATTERN = /^(?!.*\.\.)[a-z0-9][a-z0-9._-]{1,18}[a-z0-9]$/;

export function normalizeLoginId(s: string): string {
  return s.trim().toLowerCase();
}

/** normalizeLoginId で正規化した値を渡すこと（大文字は不正として扱う）。 */
export function isValidLoginId(s: string): boolean {
  return LOGIN_ID_PATTERN.test(s);
}

export function toAuthEmail(loginId: string): string {
  return `${normalizeLoginId(loginId)}@${AUTH_EMAIL_DOMAIN}`;
}
