import { ImageSegmenterResult } from "@mediapipe/tasks-vision";
import { FilterConfig } from "./types";

/**
 * BackgroundEffect
 *
 * Compositing strategy (no mirroring in canvas):
 * 1. The main canvas has the raw (un-mirrored) video frame on it.
 * 2. MediaPipe segmentation mask coordinates match the raw video frame.
 * 3. We composite in-place using pixel manipulation on ImageData.
 *
 * Mirror effect is handled by CSS on the <video> element, NOT in canvas.
 */
export class BackgroundEffect {
  private tempCanvas: HTMLCanvasElement;
  private tempCtx: CanvasRenderingContext2D;
  private bgImages: Map<string, HTMLImageElement> = new Map();

  constructor() {
    this.tempCanvas = document.createElement("canvas");
    this.tempCtx = this.tempCanvas.getContext("2d", { willReadFrequently: true })!;
  }

  private async loadBgImage(url: string): Promise<HTMLImageElement> {
    if (this.bgImages.has(url)) {
      return this.bgImages.get(url)!;
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        this.bgImages.set(url, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async apply(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    segResult: ImageSegmenterResult | null,
    config: FilterConfig
  ): Promise<void> {
    if (!segResult || !segResult.categoryMask) return;

    const { width, height } = ctx.canvas;

    // Sync temp canvas dimensions
    if (this.tempCanvas.width !== width || this.tempCanvas.height !== height) {
      this.tempCanvas.width = width;
      this.tempCanvas.height = height;
    }

    // Mediapipe mask: 0 = background, 1 = person
    const mask = segResult.categoryMask.getAsUint8Array();

    // Read the current canvas pixels (has the raw video frame, no mirroring)
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    if (config.activeFilter === "blur_bg") {
      // Draw the raw video (un-mirrored, same as canvas) into tempCanvas with blur
      this.tempCtx.filter = `blur(${config.blurIntensity}px)`;
      this.tempCtx.clearRect(0, 0, width, height);
      this.tempCtx.drawImage(video, 0, 0, width, height);
      this.tempCtx.filter = "none";
      const blurredData = this.tempCtx.getImageData(0, 0, width, height).data;

      // Replace background pixels with blurred version
      // mask[i] === 0 → background pixel → replace with blurred
      // mask[i] === 1 → person pixel → keep original
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] === 0) {
          const pi = i * 4;
          pixels[pi]     = blurredData[pi];
          pixels[pi + 1] = blurredData[pi + 1];
          pixels[pi + 2] = blurredData[pi + 2];
          // Keep alpha as-is
        }
      }

    } else if (config.activeFilter === "virtual_bg" && config.virtualBgUrl) {
      try {
        const bgImg = await this.loadBgImage(config.virtualBgUrl);

        // Draw background image cover-fit to tempCanvas
        this.tempCtx.clearRect(0, 0, width, height);

        const imgRatio    = bgImg.width / bgImg.height;
        const canvasRatio = width / height;
        let drawW: number, drawH: number, drawX: number, drawY: number;

        if (imgRatio > canvasRatio) {
          drawH = height;
          drawW = bgImg.width * (height / bgImg.height);
          drawX = (width - drawW) / 2;
          drawY = 0;
        } else {
          drawW = width;
          drawH = bgImg.height * (width / bgImg.width);
          drawX = 0;
          drawY = (height - drawH) / 2;
        }

        this.tempCtx.drawImage(bgImg, drawX, drawY, drawW, drawH);
        const bgData = this.tempCtx.getImageData(0, 0, width, height).data;

        // Replace background pixels with virtual background image
        for (let i = 0; i < mask.length; i++) {
          if (mask[i] === 0) {
            const pi = i * 4;
            pixels[pi]     = bgData[pi];
            pixels[pi + 1] = bgData[pi + 1];
            pixels[pi + 2] = bgData[pi + 2];
          }
        }
      } catch (err) {
        console.error("Error drawing virtual background:", err);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }
}
