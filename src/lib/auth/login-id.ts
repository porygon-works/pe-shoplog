export const AUTH_EMAIL_DOMAIN = "users.pe-shoplog.invalid";

const LOGIN_ID_PATTERN = /^[a-z0-9_]{3,20}$/;

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
