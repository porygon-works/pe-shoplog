import { NextResponse } from "next/server";
import { autocomplete } from "@/lib/places/google";
import { badRequest, placesFailure, requireUser } from "@/lib/places/route-helpers";

function num(v: string | null): number | null {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const session = params.get("session")?.trim() ?? "";
  if (!q) return badRequest();

  const lat = num(params.get("lat"));
  const lng = num(params.get("lng"));
  const bias = lat !== null && lng !== null ? { lat, lng } : undefined;

  try {
    const suggestions = await autocomplete(q, session, bias);
    return NextResponse.json({ suggestions });
  } catch (e) {
    return placesFailure(e);
  }
}
