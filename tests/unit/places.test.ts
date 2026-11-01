import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  autocomplete,
  getPlaceBasics,
  getPlaceWebsite,
  PlacesError,
} from "@/lib/places/google";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_PLACES_API_KEY;
});

describe("getPlaceBasics", () => {
  it("FieldMask と API キーを付けて呼び、整形して返す", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: "p1",
        displayName: { text: "ラーメン店" },
        location: { latitude: 35.1, longitude: 139.2 },
      }),
    );
    const r = await getPlaceBasics("p1", "tok");
    expect(r).toEqual({ placeId: "p1", name: "ラーメン店", lat: 35.1, lng: 139.2 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://places.googleapis.com/v1/places/p1");
    expect(String(url)).toContain("sessionToken=tok");
    // 店名を日本語で受け取る
    expect(String(url)).toContain("languageCode=ja");
    expect(init.headers["X-Goog-FieldMask"]).toBe("id,displayName,location");
    expect(init.headers["X-Goog-Api-Key"]).toBe("test-key");
  });
});

describe("getPlaceWebsite", () => {
  it("FieldMask は websiteUri だけ。なければ null", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    expect(await getPlaceWebsite("p1")).toBeNull();
    expect(fetchMock.mock.calls[0][1].headers["X-Goog-FieldMask"]).toBe("websiteUri");
  });

  it("あれば URL を返す", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ websiteUri: "https://example.com" }));
    expect(await getPlaceWebsite("p1")).toBe("https://example.com");
  });
});

describe("エラー", () => {
  it("403 で PlacesError(403) を throw する", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: {} }, 403));
    const err = await getPlaceWebsite("p1").catch((e) => e);
    expect(err).toBeInstanceOf(PlacesError);
    expect(err.status).toBe(403);
  });

  it("API キー未設定なら Google を呼ばず PlacesError(500)", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const err = await getPlaceWebsite("p1").catch((e) => e);
    expect(err).toBeInstanceOf(PlacesError);
    expect(err.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("autocomplete", () => {
  it("body に includedPrimaryTypes と sessionToken が入り、placePrediction だけ返す", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        suggestions: [
          {
            placePrediction: {
              placeId: "p1",
              structuredFormat: {
                mainText: { text: "店A" },
                secondaryText: { text: "東京" },
              },
            },
          },
          { queryPrediction: { text: { text: "ramen" } } },
        ],
      }),
    );
    const r = await autocomplete("ラー", "tok", { lat: 35, lng: 139 });
    expect(r).toEqual([{ placeId: "p1", mainText: "店A", secondaryText: "東京" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.includedPrimaryTypes).toEqual(["restaurant", "bar", "cafe"]);
    expect(body.sessionToken).toBe("tok");
    expect(body.languageCode).toBe("ja");
    expect(body.regionCode).toBe("jp");
    expect(body.locationBias.circle.radius).toBe(5000);
  });

  it("結果なしは空配列", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    expect(await autocomplete("x", "tok")).toEqual([]);
  });
});

describe("placeId の検証", () => {
  it.each(["..", "a/b", "a?b=1", "a b", ""])("不正な placeId %j は 400 で拒否し fetch しない", async (id) => {
    await expect(getPlaceBasics(id)).rejects.toMatchObject({ status: 400 });
    await expect(getPlaceWebsite(id)).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("英数字・-・_ の placeId は受け付ける", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: "ChIJ-a_1", displayName: { text: "x" }, location: { latitude: 1, longitude: 2 } }),
    );
    await expect(getPlaceBasics("ChIJ-a_1")).resolves.toMatchObject({ placeId: "ChIJ-a_1" });
  });
});
