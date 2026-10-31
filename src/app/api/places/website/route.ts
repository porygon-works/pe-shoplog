import { NextResponse } from "next/server";
import { getPlaceWebsite } from "@/lib/places/google";
import { badRequest, placesFailure, requireUser } from "@/lib/places/route-helpers";

export async function GET(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return badRequest();

  try {
    return NextResponse.json({ url: await getPlaceWebsite(id) });
  } catch (e) {
    return placesFailure(e);
  }
}
