import { NextResponse } from "next/server";
import { getPlaceBasics, isValidPlaceId } from "@/lib/places/google";
import { badRequest, guardPlaces, placesFailure } from "@/lib/places/route-helpers";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id")?.trim() ?? "";
  if (!id || !isValidPlaceId(id)) return badRequest();
  // 入力が正しいときだけ数える。未ログインは 401、上限なら 429（Google は呼ばない）。
  const denied = await guardPlaces("details");
  if (denied) return denied;
  const session = params.get("session")?.trim() || undefined;

  try {
    return NextResponse.json(await getPlaceBasics(id, session));
  } catch (e) {
    return placesFailure(e);
  }
}
