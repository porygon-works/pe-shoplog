import "server-only";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { PlacesError } from "./google";

/** 未ログインなら 401 のレスポンスを返す。ログイン済みなら null。 */
export async function requireUser(): Promise<NextResponse | null> {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
