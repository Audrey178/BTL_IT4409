import { FaceLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { FilterConfig, MaskConfig } from "./types";

export const MASK_REGISTRY: Record<string, MaskConfig> = {
  crown: { src: "/masks/crown.png", offsetX: 0, offsetY: -120, scale: 2.2, referenceWidth: 100 },
  glasses: { src: "/masks/glasses.png", offsetX: 0, offsetY: -10, scale: 2.0, referenceWidth: 100 },
  mustache: { src: "/masks/mustache.png", offsetX: 0, offsetY: 40, scale: 1.5, referenceWidth: 100 },
};

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

  apply(ctx: CanvasRenderingContext2D, faceResult: FaceLandmarkerResult | null, config: FilterConfig): void {
    if (!faceResult || !faceResult.faceLandmarks || faceResult.faceLandmarks.length === 0) return;
    if (config.activeMasks.length === 0) return;

    const landmarks = faceResult.faceLandmarks[0];
    const { width, height } = ctx.canvas;

    const toCanvas = (lm: NormalizedLandmark) => ({
      x: lm.x * width,
      y: lm.y * height,
    });

    const leftEye = toCanvas(landmarks[33]);
    const rightEye = toCanvas(landmarks[263]);
    const faceWidth = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
    const faceAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    const faceCenterX = (leftEye.x + rightEye.x) / 2;
    const faceCenterY = (leftEye.y + rightEye.y) / 2;

    for (const maskId of config.activeMasks) {
      const maskConfig = MASK_REGISTRY[maskId];
      if (!maskConfig) continue;

      const img = this.maskImages.get(maskId);
      if (!img || !img.complete) continue;

      ctx.save();
      ctx.translate(faceCenterX, faceCenterY);
      ctx.rotate(faceAngle);

      const scale = faceWidth / maskConfig.referenceWidth;
      const drawW = img.width * scale * maskConfig.scale;
      const drawH = img.height * scale * maskConfig.scale;

      ctx.drawImage(
        img,
        maskConfig.offsetX * scale - drawW / 2,
        maskConfig.offsetY * scale - drawH / 2,
        drawW,
        drawH
      );
      ctx.restore();
    }
  }
}
