import { describe, expect, it, vi } from "vitest";
import { refreshStaleLocations } from "@/lib/places/refresh-locations";

describe("refreshStaleLocations", () => {
  it("1 件失敗しても残りを続け、更新数と失敗数を返す", async () => {
    const save = vi.fn(async () => {});
    const fetchLocation = vi
      .fn()
      .mockResolvedValueOnce({ lat: 1, lng: 2 })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ lat: 5, lng: 6 });
    const result = await refreshStaleLocations({
      listStale: async () => [
        { id: "a", placeId: "pa" },
        { id: "b", placeId: "pb" },
        { id: "c", placeId: "pc" },
      ],
      fetchLocation,
      save,
    });
    expect(result).toEqual({ updated: 2, failed: 1 });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledWith("a", { lat: 1, lng: 2 });
    expect(save).toHaveBeenCalledWith("c", { lat: 5, lng: 6 });
  });

  it("save の失敗も failed に数える", async () => {
    const result = await refreshStaleLocations({
      listStale: async () => [{ id: "a", placeId: "pa" }],
      fetchLocation: async () => ({ lat: 1, lng: 2 }),
      save: async () => {
        throw new Error("db");
      },
    });
    expect(result).toEqual({ updated: 0, failed: 1 });
  });

  it("limit を listStale に渡す（既定 200）", async () => {
    const listStale = vi.fn(async () => []);
    await refreshStaleLocations({ listStale, fetchLocation: vi.fn(), save: vi.fn() });
    expect(listStale).toHaveBeenCalledWith(200);
  });
});
