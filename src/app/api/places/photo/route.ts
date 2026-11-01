import { NextResponse } from "next/server";
import { getPlacePhoto, isValidPlaceId } from "@/lib/places/google";
import { badRequest, placesFailure, requireUser } from "@/lib/places/route-helpers";

export async function GET(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id || !isValidPlaceId(id)) return badRequest();

  try {
    // 写真 URL は期限付きなので、ブラウザにもキャッシュさせない。
    return NextResponse.json({ photo: await getPlacePhoto(id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return placesFailure(e);
  }
}
