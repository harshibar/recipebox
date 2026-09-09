// Photo capture. Uses a plain file input with `capture` rather than a
// getUserMedia viewfinder: on Android that hands off to the real camera app,
// which focuses better, survives greasy hands, and needs no permission dance.

const MAX_EDGE = 1600;      // plenty for a cook log, small enough to sync
const JPEG_QUALITY = 0.82;

/** Opens the camera and resolves with the chosen file, or null if cancelled. */
export function takePhoto({ source = 'camera' } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener('change', () => done(input.files?.[0] || null));
    // Chrome fires focus back on the window when the picker is dismissed; give
    // `change` a moment to land first so a real pick is never read as a cancel.
    window.addEventListener('focus', () => setTimeout(() => done(null), 1500), { once: true });

    input.click();
  });
}

/**
 * Downscale and re-encode to JPEG. A modern phone photo is 3-6 MB; a cook log
 * with twenty of them would blow the origin storage quota and make syncing
 * miserable, so everything gets normalised on the way in.
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export async function normalizeImage(file, maxEdge = MAX_EDGE) {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) throw new Error('Could not process that photo.');
  return { blob, width, height };
}

async function loadBitmap(file) {
  // createImageBitmap applies EXIF orientation; the <img> fallback does too in
  // every browser that lacks it.
  if (globalThis.createImageBitmap) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
