import { NextResponse } from "next/server";
import { logEvent } from "@/lib/log/server";
import { guardPlaces } from "@/lib/places/route-helpers";

const ACTION_RE = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_BODY = 4000;

/**
 * 画面（スマホ側）で起きたエラーを操作ログに残す。ログインしている人だけ、1 人 1 日の回数に上限あり。
 * 本文は短くして保存する（コメント本文などは画面側でも送らない）。
 */
export async function POST(request: Request) {
  const denied = await guardPlaces("clientlog");
  if (denied) return denied;

  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "too_large" }, { status: 413 });
  let body: { action?: unknown; path?: unknown; detail?: unknown; at?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof body.action !== "string" || !ACTION_RE.test(body.action)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const detail = body.detail && typeof body.detail === "object" && !Array.isArray(body.detail) ? (body.detail as Record<string, unknown>) : {};
  logEvent({
    action: body.action,
    level: "error",
    source: "client",
    path: typeof body.path === "string" ? body.path : null,
    // 圏外でためておいたものは、起きた時刻（スマホの時計）も残す。
    detail: typeof body.at === "string" ? { ...detail, occurredAt: body.at } : detail,
  });
  return new NextResponse(null, { status: 204 });
}
