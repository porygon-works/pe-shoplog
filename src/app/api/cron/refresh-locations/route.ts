import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createRefreshDeps, refreshStaleLocations } from "@/lib/places/refresh-locations";

export const dynamic = "force-dynamic";

/** 長さが違っても時間が漏れないよう、ハッシュせず固定長に詰めて比較する。 */
function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length, 1);
  const x = Buffer.alloc(len);
  const y = Buffer.alloc(len);
  x.write(a);
  y.write(b);
  return timingSafeEqual(x, y) && a.length === b.length;
}

// /api は proxy の対象外なので、この Bearer 確認が唯一の門番。
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!safeEqual(token, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await refreshStaleLocations(createRefreshDeps(), 200));
  } catch (e) {
    console.error("refresh-locations error", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "refresh_failed" }, { status: 500 });
  }
}
