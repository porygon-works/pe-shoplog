import { LOGIN_ID_PATTERN } from "@/lib/auth/login-id";
import { z } from "zod";
import { CATEGORY_VALUE_RE } from "@/lib/category-utils";
import {
  PAYMENT_METHODS,
  PRICE_RANGES,
  RESERVATIONS,
  SMOKING,
  TIME_SLOTS,
  values,
} from "@/lib/options";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "日付が正しくありません");

const httpUrl = z
  .string()
  .max(2000)
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "http または https の URL を入力してください");

export const shopInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  // ジャンル・形態は DB で管理するので形式だけ見る。存在チェックは Server Action 側で行う。
  // ジャンルは複数可。何も選ばない = 未設定（「不明」は入れない）。重複は除く。
  genres: z
    .array(z.string().regex(CATEGORY_VALUE_RE))
    .max(50)
    .transform((a) => [...new Set(a)].filter((g) => g !== "unknown"))
    .default([]),
  styles: z.array(z.string().regex(CATEGORY_VALUE_RE)).max(50).default([]),
  referenceUrl: z.union([httpUrl, z.literal("")]).default(""),
  // 時間帯は最低 1 つ。重複は除く。
  timeSlots: z
    .array(z.enum(values(TIME_SLOTS)))
    .min(1)
    .transform((a) => [...new Set(a)])
    .default(["dinner"]),
});
export type ShopInput = z.infer<typeof shopInputSchema>;

export const visitInputSchema = z.object({
  // 行った日は任意（空なら日付なし）。
  visitedOn: isoDate.nullable().default(null),
  rating: z.number().int().min(1).max(5).nullable().default(null),
  partySize: z.number().int().min(1).max(500).nullable().default(null),
  comment: z.string().max(1000).default(""),
  smoking: z.enum(values(SMOKING)).default("unknown"),
  priceRange: z.enum(values(PRICE_RANGES)).default("unknown"),
  // 用途は DB で管理するので形式だけ見る（存在確認は Server Action と DB のトリガー）。
  purpose: z.string().regex(CATEGORY_VALUE_RE).default("unknown"),
  reservation: z.enum(values(RESERVATIONS)).default("unknown"),
  paymentMethods: z.array(z.enum(values(PAYMENT_METHODS))).default([]),
});
export type VisitInput = z.infer<typeof visitInputSchema>;

export const signupInputSchema = z.object({
  loginId: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      LOGIN_ID_PATTERN,
      "ユーザーIDは英小文字・数字・記号（. _ -）の 3〜20 文字です（最初と最後は英数字）",
    ),
  nickname: z.string().trim().min(1).max(20),
  password: z.string().min(8),
  passphrase: z.string().trim().min(1),
});
export type SignupInput = z.infer<typeof signupInputSchema>;
