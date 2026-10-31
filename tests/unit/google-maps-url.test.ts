import { describe, expect, it } from "vitest";
import { googleMapsUrl } from "@/lib/shops/google-maps-url";

describe("googleMapsUrl", () => {
  it("placeId があれば query_place_id 付きの URL にする", () => {
    expect(googleMapsUrl({ name: "鳥良", lat: 35.1, lng: 139.2, placeId: "ChIJabc" })).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("鳥良")}&query_place_id=ChIJabc`,
    );
  });
  it("placeId がなければ緯度経度で検索する", () => {
    expect(googleMapsUrl({ name: "鳥良", lat: 35.659, lng: 139.7, placeId: null })).toBe(
      "https://www.google.com/maps/search/?api=1&query=35.659,139.7",
    );
  });
  it("店名の & などはエンコードされる", () => {
    const url = googleMapsUrl({ name: "A&B 酒場", lat: 1, lng: 2, placeId: "p1" });
    expect(url).toContain("query=A%26B%20%E9%85%92%E5%A0%B4&");
    expect(url).not.toContain("A&B");
  });
});
