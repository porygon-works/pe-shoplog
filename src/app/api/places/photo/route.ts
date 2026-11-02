import { NextResponse } from "next/server";
import { getPlacePhoto, isValidPlaceId } from "@/lib/places/google";
import { badRequest, guardPlaces, placesFailure } from "@/lib/places/route-helpers";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id || !isValidPlaceId(id)) return badRequest();
  // 入力が正しいときだけ数える。未ログインは 401、上限なら 429（Google は呼ばない）。
  const denied = await guardPlaces("photo");
  if (denied) return denied;

  try {
    // 写真 URL は期限付きなので、ブラウザにもキャッシュさせない。
    return NextResponse.json({ photo: await getPlacePhoto(id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return placesFailure(e);
  }
}
