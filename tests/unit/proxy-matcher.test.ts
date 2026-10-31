import { describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));

import { safeNextPath } from "@/lib/auth/next-path";
import { PROXY_MATCHER, config } from "@/proxy";

const re = new RegExp(`^${PROXY_MATCHER}$`);

describe("proxy matcher", () => {
  it("config uses the exported matcher", () => {
    expect(config.matcher[0]).toBe(PROXY_MATCHER);
  });
  it.each([
    "/sw.js",
    "/manifest.webmanifest",
    "/api/places/details",
    "/icon.svg",
    "/favicon.ico",
    "/_next/static/chunks/a.js",
    "/_next/image",
  ])("skips %s", (p) => {
    expect(re.test(p)).toBe(false);
  });
  it.each(["/", "/shops/abc", "/invite/tok", "/login"])("matches %s", (p) => {
    expect(re.test(p)).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNextPath("/invite/abc?x=1")).toBe("/invite/abc?x=1");
    expect(safeNextPath("/shops/1")).toBe("/shops/1");
  });
  it.each([null, "", "map", "//evil.com", "/\\evil.com", "https://evil.com", "/a\nb"])(
    "falls back for %j",
    (raw) => {
      expect(safeNextPath(raw)).toBe("/map");
    },
  );
});
