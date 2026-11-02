import "server-only";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { PlacesError } from "./google";
import { consumePlacesQuota, type PlacesKind } from "./quota";

/** 未ログインなら 401 のレスポンスを返す。ログイン済みなら null。 */
export async function requireUser(): Promise<NextResponse | null> {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

/**
 * ログインの確認と、Google を呼ぶ前の使用回数の確認。問題なければ null。
 * 未ログインは 401、上限に達していたら 429（Google は呼ばないので料金は発生しない）。
 */
export async function guardPlaces(kind: PlacesKind): Promise<NextResponse | null> {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await consumePlacesQuota(kind, userId))) {
    return NextResponse.json({ error: "limit_reached" }, { status: 429 });
  }
  return null;
}

export function badRequest() {
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}

export function placesFailure(e: unknown) {
  if (e instanceof PlacesError) {
    console.error("places error", e.status, e.message);
    return NextResponse.json({ error: "places_unavailable" }, { status: 502 });
  }
  throw e;
}
