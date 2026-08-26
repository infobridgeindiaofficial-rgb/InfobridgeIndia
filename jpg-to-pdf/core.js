export const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

export function isSupportedImage(file) {
  if (!file) return false;
  if (SUPPORTED_IMAGE_TYPES.has((file.type || "").toLowerCase())) return true;
  return /\.(jpe?g|png)$/i.test(file.name || "");
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function fitInside(sourceWidth, sourceHeight, boxWidth, boxHeight) {
  if (![sourceWidth, sourceHeight, boxWidth, boxHeight].every((n) => Number.isFinite(n) && n > 0)) throw new Error("Invalid image or page dimensions.");
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { width, height, x: (boxWidth - width) / 2, y: (boxHeight - height) / 2 };
}

export function detectImageFormat(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 8) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "JPEG";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "PNG";
  return null;
}
