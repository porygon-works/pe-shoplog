import { NextResponse } from "next/server";
import { getPlaceWebsite, isValidPlaceId } from "@/lib/places/google";
import { badRequest, guardPlaces, placesFailure } from "@/lib/places/route-helpers";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id || !isValidPlaceId(id)) return badRequest();
  // 入力が正しいときだけ数える。未ログインは 401、上限なら 429（Google は呼ばない）。
  const denied = await guardPlaces("website");
  if (denied) return denied;

  try {
    return NextResponse.json({ url: await getPlaceWebsite(id) });
  } catch (e) {
    return placesFailure(e);
  }
}
