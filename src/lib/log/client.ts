"use client";

const QUEUE_KEY = "pe-log-queue";
const MAX_QUEUE = 30;

type Pending = { action: string; path: string; detail: Record<string, unknown>; at: string };

function readQueue(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as Pending[];
  } catch {
    return [];
  }
}

function writeQueue(q: Pending[]) {
  try {
    if (q.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
  } catch {
    // 保存できなければあきらめる
  }
}

async function send(p: Pending): Promise<boolean> {
  try {
    const res = await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
      keepalive: true,
    });
    // 上限・未ログインなどは送り直しても同じなので、送れたことにする。
    return res.ok || (res.status >= 400 && res.status < 500);
  } catch {
    return false;
  }
}

/**
 * 画面で起きたエラーを操作ログに送る。圏外などで送れなければ端末にためて、次に開いたときや電波が戻ったときに送る。
 * detail には id・エラーの種類だけを入れる（コメント本文などは入れない）。
 */
export function reportClientError(action: string, detail: Record<string, unknown> = {}): void {
  const p: Pending = { action, path: location.pathname + location.search, detail, at: new Date().toISOString() };
  void send(p).then((ok) => {
    if (!ok) writeQueue([...readQueue(), p]);
  });
}

/** ためておいたエラーを送る。 */
export async function flushClientErrors(): Promise<void> {
  const q = readQueue();
  if (q.length === 0) return;
  writeQueue([]);
  const failed: Pending[] = [];
  for (const p of q) if (!(await send(p))) failed.push(p);
  if (failed.length) writeQueue([...failed, ...readQueue()]);
}

/** 例外を、ログに残せる短い説明にする。 */
export function describeError(e: unknown): Record<string, unknown> {
  if (e instanceof Error) return { name: e.name, message: e.message.slice(0, 200) };
  return { message: String(e).slice(0, 200) };
}
