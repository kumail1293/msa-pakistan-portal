/**
 * Client-side automatic background removal for signature images.
 *
 * Strategy: estimate the background colour from the four corner regions,
 * then flood-fill from every border pixel whose colour is within tolerance.
 * The flood fill only removes background that is CONNECTED to the edge, so
 * enclosed holes inside letters ("o", "e", "g", ...) and the dark ink of the
 * signature itself are preserved. Light edge pixels are feathered so the
 * result blends cleanly onto the card. Output is a `data:image/png;base64`
 * data URL with transparency — the exact format the server accepts.
 */

const DEFAULT_MAX_DIMENSION = 600;

export type BackgroundRemovalOptions = {
  /** 0..100 colour-distance tolerance. Higher removes more (shadows, stains). */
  tolerance?: number;
  /** Longest edge of the output image in px (keeps the data URL small). */
  maxDimension?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode that image."));
    img.src = src;
  });
}

/**
 * Remove the background from a signature image file and return a transparent
 * PNG data URL, cropped tightly to the signature with a small padding.
 */
export async function removeImageBackground(
  file: File,
  options: BackgroundRemovalOptions = {}
): Promise<string> {
  const tolerance = clamp(options.tolerance ?? 34, 0, 100);
  const maxDim = clamp(options.maxDimension ?? DEFAULT_MAX_DIMENSION, 120, 1600);

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(
      1,
      maxDim / Math.max(img.naturalWidth, img.naturalHeight)
    );
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas is not supported in this browser.");
    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const { data } = imageData;

    // ---- 1. Estimate the background colour from the four corners ----------
    const corner = Math.max(2, Math.floor(Math.min(w, h) * 0.08));
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;
    const addCorner = (x0: number, y0: number) => {
      for (let y = y0; y < Math.min(h, y0 + corner); y++) {
        for (let x = x0; x < Math.min(w, x0 + corner); x++) {
          const i = (y * w + x) * 4;
          rSum += data[i];
          gSum += data[i + 1];
          bSum += data[i + 2];
          count += 1;
        }
      }
    };
    addCorner(0, 0);
    addCorner(Math.max(0, w - corner), 0);
    addCorner(0, Math.max(0, h - corner));
    addCorner(Math.max(0, w - corner), Math.max(0, h - corner));
    const bgR = rSum / count;
    const bgG = gSum / count;
    const bgB = bSum / count;

    const distanceSq = (i: number) => {
      const dr = data[i] - bgR;
      const dg = data[i + 1] - bgG;
      const db = data[i + 2] - bgB;
      return dr * dr + dg * dg + db * db;
    };
    // tolerance is 0..100 -> threshold on channel distance (0..255).
    const threshold = Math.pow((tolerance / 100) * 255, 2);

    // ---- 2. Flood fill from every border pixel that looks like background --
    const transparent = new Uint8Array(w * h);
    const queue: number[] = [];
    const seed = (x: number, y: number) => {
      const idx = y * w + x;
      if (transparent[idx]) return;
      if (data[idx * 4 + 3] === 0 || distanceSq(idx * 4) <= threshold) {
        transparent[idx] = 1;
        queue.push(idx);
      }
    };
    for (let x = 0; x < w; x++) {
      seed(x, 0);
      seed(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      seed(0, y);
      seed(w - 1, y);
    }
    while (queue.length > 0) {
      const idx = queue.pop()!;
      const x = idx % w;
      const y = (idx / w) | 0;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nIdx = ny * w + nx;
        if (transparent[nIdx]) continue;
        if (data[nIdx * 4 + 3] === 0 || distanceSq(nIdx * 4) <= threshold) {
          transparent[nIdx] = 1;
          queue.push(nIdx);
        }
      }
    }

    // ---- 3. Feather: fade light pixels just outside the removed area -------
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!transparent[idx]) continue;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue;
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const nIdx = ny * w + nx;
            if (transparent[nIdx] || data[nIdx * 4 + 3] === 0) continue;
            // Only feather light pixels; dark ink stays fully opaque.
            const lum =
              0.299 * data[nIdx * 4] +
              0.587 * data[nIdx * 4 + 1] +
              0.114 * data[nIdx * 4 + 2];
            if (lum < 120) continue;
            const d = Math.sqrt(distanceSq(nIdx * 4));
            if (d < threshold * 1.6) {
              const keep = Math.max(0, 1 - (1 - d / (threshold * 1.6)) * 0.65);
              data[nIdx * 4 + 3] = Math.min(
                data[nIdx * 4 + 3],
                Math.round(data[nIdx * 4 + 3] * keep)
              );
            }
          }
        }
      }
    }

    // ---- 4. Make the connected background transparent ----------------------
    for (let i = 0; i < transparent.length; i++) {
      if (transparent[i]) data[i * 4 + 3] = 0;
    }
    ctx.putImageData(imageData, 0, 0);

    // ---- 5. Crop tightly to the content + padding --------------------------
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const pad = 6;
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(w - cropX, maxX - minX + 1 + pad * 2);
    const cropH = Math.min(h - cropY, maxY - minY + 1 + pad * 2);

    if (maxX === -1) {
      // Everything was removed (blank image) — return the original capture so
      // the user can see what happened and try again with a lower tolerance.
      return canvas.toDataURL("image/png");
    }

    const out = document.createElement("canvas");
    out.width = cropW;
    out.height = cropH;
    const octx = out.getContext("2d");
    if (!octx) throw new Error("Canvas is not supported in this browser.");
    octx.clearRect(0, 0, cropW, cropH);
    octx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    return out.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
