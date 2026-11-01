import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  autocomplete,
  getPlaceBasics,
  getPlacePhoto,
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

describe("getPlacePhoto", () => {
  const photoName = "places/p1/photos/AbC_-123";

  it("FieldMask は photos。media の URL で photoUri を取り、投稿者を整形して返す", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          photos: [
            {
              name: photoName,
              authorAttributions: [
                { displayName: "山田", uri: "https://maps.google.com/u/1", photoUri: "https://x/a" },
                { displayName: "鈴木", uri: "javascript:alert(1)" },
              ],
            },
            { name: "places/p1/photos/second" },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ name: `${photoName}/media`, photoUri: "https://lh3.googleusercontent.com/x" }));
    const r = await getPlacePhoto("p1");
    expect(r).toEqual({
      url: "https://lh3.googleusercontent.com/x",
      authors: [
        { name: "山田", uri: "https://maps.google.com/u/1" },
        { name: "鈴木", uri: null },
      ],
    });
    const [detailUrl, detailInit] = fetchMock.mock.calls[0];
    expect(String(detailUrl)).toContain("languageCode=ja");
    expect(detailInit.headers["X-Goog-FieldMask"]).toBe("photos");
    const [mediaUrl, mediaInit] = fetchMock.mock.calls[1];
    expect(String(mediaUrl)).toBe(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&skipHttpRedirect=true`,
    );
    expect(mediaInit.headers["X-Goog-Api-Key"]).toBe("test-key");
  });

  it("写真がなければ null（media は呼ばない）", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    expect(await getPlacePhoto("p1")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("不正な写真名は URL に使わず PlacesError", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ photos: [{ name: "places/p1/photos/a/../../b?x=1" }] }));
    await expect(getPlacePhoto("p1")).rejects.toBeInstanceOf(PlacesError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
                secondaryText: { text: "日本、東京" },
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
