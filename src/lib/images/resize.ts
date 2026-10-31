export class ImageDecodeError extends Error {
  constructor(message = "この画像は読み込めません") {
    super(message);
    this.name = "ImageDecodeError";
  }
}

/** 長辺が maxEdge を超えるときだけ、縦横比を保って縮小したサイズを返す。 */
export function computeTargetSize(
  w: number,
  h: number,
  maxEdge = 1600,
): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // <img> でのデコードを試す
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageDecodeError();
  }
}

/**
 * 長辺 maxEdge に縮小し、canvas で JPEG に再エンコードする。
 * 再エンコードで EXIF（撮影場所など）は消える。
 */
export async function resizeToJpeg(
  file: File,
  maxEdge = 1600,
  quality = 0.8,
): Promise<{ blob: Blob; width: number; height: number }> {
  const decoded = await decode(file);
  try {
    if (!decoded.width || !decoded.height) throw new ImageDecodeError();
    const { width, height } = computeTargetSize(decoded.width, decoded.height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageDecodeError();
    ctx.drawImage(decoded.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new ImageDecodeError();
    return { blob, width, height };
  } finally {
    decoded.close();
  }
}
