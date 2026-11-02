import { NextResponse } from "next/server";
import { guardPlaces } from "@/lib/places/route-helpers";

/**
 * 地図を表示する前に 1 回分を数える。上限に達していたら 429 を返し、画面は Google の地図を読み込まない。
 * （Maps JavaScript API の地図読み込みは Google 側で上限を変えられないため、アプリ側で止める。）
 */
export async function POST() {
  const denied = await guardPlaces("mapload");
  if (denied) return denied;
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
