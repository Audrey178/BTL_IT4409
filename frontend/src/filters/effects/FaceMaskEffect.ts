import { FaceLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { FilterConfig, MaskConfig } from "./types";

export const MASK_REGISTRY: Record<string, MaskConfig> = {
  crown:    { src: "/masks/crown.png",    offsetX: 0, offsetY: -120, scale: 2.2, referenceWidth: 100 },
  glasses:  { src: "/masks/glasses.png",  offsetX: 0, offsetY: -10,  scale: 2.0, referenceWidth: 100 },
  mustache: { src: "/masks/mustache.png", offsetX: 0, offsetY: 40,   scale: 1.5, referenceWidth: 100 },
};

/**
 * FaceMaskEffect
 *
 * Draws PNG stickers on top of detected face landmarks.
 *
 * Key points:
 * - Canvas has un-mirrored video frame (mirror is done via CSS on <video>).
 * - MediaPipe landmark coordinates are in normalized [0,1] space matching the
 *   un-mirrored video → we multiply directly by canvas width/height.
 * - We use globalCompositeOperation = "source-over" (default) which correctly
 *   respects PNG alpha transparency.
 * - ctx.save()/restore() prevents filter or transform leaking between draws.
 * - We explicitly reset ctx.filter = "none" before drawing masks so the color
 *   CSS filter from Step 1 doesn't affect the sticker colors.
 */
export class FaceMaskEffect {
  private maskImages: Map<string, HTMLImageElement> = new Map();

  constructor() {
    this.preloadMasks();
  }

  private preloadMasks() {
    Object.keys(MASK_REGISTRY).forEach((id) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = MASK_REGISTRY[id].src;
      this.maskImages.set(id, img);
    });
  }

  apply(
    ctx: CanvasRenderingContext2D,
    faceResult: FaceLandmarkerResult | null,
    config: FilterConfig
  ): void {
    if (!faceResult?.faceLandmarks?.length) return;
    if (config.activeMasks.length === 0) return;

    const landmarks = faceResult.faceLandmarks[0];
    const { width, height } = ctx.canvas;

    // Convert normalized landmark to canvas pixel coordinates (no mirroring)
    const toCanvas = (lm: NormalizedLandmark) => ({
      x: lm.x * width,
      y: lm.y * height,
    });

    // Use outer eye corners for a stable, wide face width measurement
    const leftEye  = toCanvas(landmarks[33]);   // left eye inner
    const rightEye = toCanvas(landmarks[263]);  // right eye inner
    const faceWidth  = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
    const faceAngle  = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    const faceCenterX = (leftEye.x + rightEye.x) / 2;
    const faceCenterY = (leftEye.y + rightEye.y) / 2;

    for (const maskId of config.activeMasks) {
      const maskConfig = MASK_REGISTRY[maskId];
      if (!maskConfig) continue;

      const img = this.maskImages.get(maskId);
      // Skip if image not loaded yet
      if (!img || !img.complete || img.naturalWidth === 0) continue;

      ctx.save();

      // CRITICAL: Reset filter so CSS color filters don't tint the mask PNG
      ctx.filter = "none";

      // CRITICAL: Ensure we're using normal compositing so PNG transparency works
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;

      // Move origin to face center, then rotate to align with face tilt
      ctx.translate(faceCenterX, faceCenterY);
      ctx.rotate(faceAngle);

      const scale  = faceWidth / maskConfig.referenceWidth;
      const drawW  = img.naturalWidth  * scale * maskConfig.scale;
      const drawH  = img.naturalHeight * scale * maskConfig.scale;
      const drawX  = maskConfig.offsetX * scale - drawW / 2;
      const drawY  = maskConfig.offsetY * scale - drawH / 2;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      ctx.restore();
    }
  }
}
