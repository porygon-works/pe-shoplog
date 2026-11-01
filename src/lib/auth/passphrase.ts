import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 32;
const SALT_BYTES = 16;

function normalize(p: string): string {
  return p.normalize("NFKC").trim().toLowerCase();
}

function derive(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(normalize(passphrase), salt, KEY_LENGTH, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** 形式: `scrypt$<saltHex>$<hashHex>`。大文字小文字と前後の空白は無視する。 */
export async function hashPassphrase(p: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(p, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassphrase(
  input: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, hashHex, ...rest] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex || rest.length > 0) {
    return false;
  }
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await derive(input, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, expected);
}
