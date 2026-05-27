import { ImageSegmenterResult } from "@mediapipe/tasks-vision";
import { FilterConfig } from "./types";

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
    
    // Ensure temp canvas matches main canvas dimensions
    if (this.tempCanvas.width !== width || this.tempCanvas.height !== height) {
      this.tempCanvas.width = width;
      this.tempCanvas.height = height;
    }

    const mask = segResult.categoryMask.getAsUint8Array();
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    if (config.activeFilter === "blur_bg") {
      this.tempCtx.filter = `blur(${config.blurIntensity}px)`;
      this.tempCtx.drawImage(video, 0, 0, width, height);
      const blurredData = this.tempCtx.getImageData(0, 0, width, height).data;

      for (let i = 0; i < mask.length; i++) {
        if (mask[i] === 0) { // Background
          const pi = i * 4;
          pixels[pi] = blurredData[pi];
          pixels[pi + 1] = blurredData[pi + 1];
          pixels[pi + 2] = blurredData[pi + 2];
        }
      }
    } else if (config.activeFilter === "virtual_bg" && config.virtualBgUrl) {
      try {
        const bgImg = await this.loadBgImage(config.virtualBgUrl);
        // Draw the background image to fill the canvas
        // First, clear
        this.tempCtx.clearRect(0, 0, width, height);
        
        // Calculate crop to cover canvas
        const imgRatio = bgImg.width / bgImg.height;
        const canvasRatio = width / height;
        let drawW, drawH, drawX, drawY;
        
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

        for (let i = 0; i < mask.length; i++) {
          if (mask[i] === 0) { // Background
            const pi = i * 4;
            pixels[pi] = bgData[pi];
            pixels[pi + 1] = bgData[pi + 1];
            pixels[pi + 2] = bgData[pi + 2];
          }
        }
      } catch (err) {
        console.error("Error drawing virtual background", err);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }
}
