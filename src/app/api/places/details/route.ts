import { NextResponse } from "next/server";
import { getPlaceBasics, isValidPlaceId } from "@/lib/places/google";
import { badRequest, placesFailure, requireUser } from "@/lib/places/route-helpers";

export async function GET(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const id = params.get("id")?.trim() ?? "";
  if (!id || !isValidPlaceId(id)) return badRequest();
  const session = params.get("session")?.trim() || undefined;

  try {
    return NextResponse.json(await getPlaceBasics(id, session));
  } catch (e) {
    return placesFailure(e);
  }
}
