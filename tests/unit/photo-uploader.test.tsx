import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
const resizeToJpeg = vi.fn();
const addPhotoAction = vi.fn();
const deletePhotoAction = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserClient: () => ({ storage: { from: () => ({ upload, remove: vi.fn() }) } }),
}));
vi.mock("@/lib/images/resize", async () => {
  const actual = await vi.importActual<typeof import("@/lib/images/resize")>("@/lib/images/resize");
  return { ...actual, resizeToJpeg: (...a: unknown[]) => resizeToJpeg(...a) };
});
vi.mock("@/lib/visits/actions", () => ({
  addPhotoAction: (...a: unknown[]) => addPhotoAction(...a),
  deletePhotoAction: (...a: unknown[]) => deletePhotoAction(...a),
}));

import { ImageDecodeError } from "@/lib/images/resize";
import { PhotoUploader } from "@/components/photo-uploader";

const VISIT = "11111111-1111-4111-8111-111111111111";
const SHOP = "22222222-2222-4222-8222-222222222222";

function file(name: string) {
  return new File(["x"], name, { type: "image/jpeg" });
}
function pick(files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  return act(async () => {
    fireEvent.change(input, { target: { files } });
  });
}

beforeEach(() => {
  resizeToJpeg.mockImplementation(async () => ({ blob: new Blob(["j"]), width: 10, height: 10 }));
  addPhotoAction.mockResolvedValue({ photoId: "p" });
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PhotoUploader", () => {
  it("2枚目だけ失敗すると 1,3 枚目は done、2枚目は error で再送でき、成功すると done になる", async () => {
    let n = 0;
    upload.mockImplementation(async () => {
      n += 1;
      return n === 2 ? { error: { message: "boom" } } : { error: null };
    });
    const onStatusChange = vi.fn();
    render(<PhotoUploader visitId={VISIT} shopId={SHOP} onStatusChange={onStatusChange} />);
    await pick([file("a.jpg"), file("b.jpg"), file("c.jpg")]);

    await waitFor(() => expect(screen.getAllByText("送信済み")).toHaveLength(2));
    expect(screen.getAllByText("送信できませんでした")).toHaveLength(1);
    const retry = screen.getByRole("button", { name: "再送" });

    await act(async () => {
      fireEvent.click(retry);
    });
    await waitFor(() => expect(screen.getAllByText("送信済み")).toHaveLength(3));
    expect(screen.queryByRole("button", { name: "再送" })).toBeNull();
    expect(addPhotoAction).toHaveBeenCalledTimes(3);
    expect(onStatusChange).toHaveBeenLastCalledWith({ pending: 0, failed: 0, done: 3 });
  });

  it("デコードできない画像は「この画像は読み込めません」で再送ボタンなし", async () => {
    resizeToJpeg.mockRejectedValueOnce(new ImageDecodeError());
    upload.mockResolvedValue({ error: null });
    render(<PhotoUploader visitId={VISIT} shopId={SHOP} />);
    await pick([file("bad.heic")]);
    await waitFor(() => expect(screen.getByText("この画像は読み込めません")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "再送" })).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it("10枚を超える分は追加しない", async () => {
    upload.mockResolvedValue({ error: null });
    render(<PhotoUploader visitId={VISIT} shopId={SHOP} />);
    await pick(Array.from({ length: 12 }, (_, i) => file(`${i}.jpg`)));
    await waitFor(() => expect(screen.getAllByText("送信済み")).toHaveLength(10));
    expect(addPhotoAction).toHaveBeenCalledTimes(10);
    expect(screen.getAllByText(/10枚までです/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("写真を追加")).toBeNull();
  });
});
