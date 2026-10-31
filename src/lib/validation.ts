import { z } from "zod";
import {
  GENRES,
  PAYMENT_METHODS,
  PRICE_RANGES,
  PURPOSES,
  RESERVATIONS,
  SMOKING,
  STYLES,
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
  genre: z.enum(values(GENRES)).default("unknown"),
  styles: z.array(z.enum(values(STYLES))).default([]),
  referenceUrl: z.union([httpUrl, z.literal("")]).default(""),
});
export type ShopInput = z.infer<typeof shopInputSchema>;

export const visitInputSchema = z.object({
  visitedOn: isoDate,
  partySize: z.number().int().min(1).max(500).nullable().default(null),
  comment: z.string().max(1000).default(""),
  smoking: z.enum(values(SMOKING)).default("unknown"),
  priceRange: z.enum(values(PRICE_RANGES)).default("unknown"),
  purpose: z.enum(values(PURPOSES)).default("unknown"),
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
      /^[a-z0-9_]{3,20}$/,
      "ユーザーIDは英小文字・数字・_ の 3〜20 文字です",
    ),
  nickname: z.string().trim().min(1).max(20),
  password: z.string().min(8),
  passphrase: z.string().trim().min(1),
});
export type SignupInput = z.infer<typeof signupInputSchema>;
