const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID の形式かどうか。DB に渡す前に確認し、不正な値で Postgres エラー(500)にしない。 */
export function isUuid(s: string): boolean {
  return UUID.test(s);
}
