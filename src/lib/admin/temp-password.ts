/** 紛らわしい 0 O 1 l I を除いた英数字（57 文字）。 */
export const TEMP_PASSWORD_ALPHABET =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export const TEMP_PASSWORD_LENGTH = 12;

/**
 * 仮パスワードを作る。剰余バイアスを避けるため、範囲外の乱数は捨てて引き直す
 * （棄却サンプリング）。
 */
export function generateTempPassword(): string {
  const n = TEMP_PASSWORD_ALPHABET.length;
  const limit = 256 - (256 % n); // これ以上の値は偏りの原因になるので使わない
  let out = "";
  while (out.length < TEMP_PASSWORD_LENGTH) {
    const buf = new Uint8Array(TEMP_PASSWORD_LENGTH * 2);
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b >= limit) continue;
      out += TEMP_PASSWORD_ALPHABET[b % n];
      if (out.length === TEMP_PASSWORD_LENGTH) break;
    }
  }
  return out;
}
