import { SegmentationModel } from "./models/SegmentationModel";
import { FaceLandmarkModel } from "./models/FaceLandmarkModel";
import { BackgroundEffect } from "./effects/BackgroundEffect";
import { FaceMaskEffect } from "./effects/FaceMaskEffect";
import { ColorFilterEffect } from "./effects/ColorFilterEffect";
import { useFilterStore } from "@/stores/filterStore";
import { FilterType } from "@/stores/filterStore";

export class VideoFilterProcessor {
  private sourceVideo: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private outputStream: MediaStream | null = null;
  private animFrameId: number | null = null;

  private segmenter: SegmentationModel | null = null;
  private faceLandmarker: FaceLandmarkModel | null = null;

  private bgEffect: BackgroundEffect;
  private faceMaskEffect: FaceMaskEffect;
  private colorEffect: ColorFilterEffect;

  private TARGET_FRAME_TIME = 33; // ~30fps
  private lastFrameTime = 0;

  constructor() {
    this.sourceVideo = document.createElement("video");
    this.sourceVideo.autoplay = true;
    this.sourceVideo.playsInline = true;
    this.sourceVideo.muted = true;

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;

    this.bgEffect = new BackgroundEffect();
    this.faceMaskEffect = new FaceMaskEffect();
    this.colorEffect = new ColorFilterEffect();
  }

  async initialize(cameraStream: MediaStream): Promise<void> {
    this.sourceVideo.srcObject = cameraStream;
    await new Promise<void>((resolve) => {
      this.sourceVideo.onloadedmetadata = () => {
        resolve();
      };
    });
    await this.sourceVideo.play();

    // Set canvas dimensions
    this.canvas.width = this.sourceVideo.videoWidth || 640;
    this.canvas.height = this.sourceVideo.videoHeight || 480;

    // Create output stream
    this.outputStream = this.canvas.captureStream(30);

    // Copy audio track if present
    const audioTrack = cameraStream.getAudioTracks()[0];
    if (audioTrack) {
      this.outputStream.addTrack(audioTrack);
    }
  }

  async loadModels(filterType: FilterType): Promise<void> {
    const { setIsProcessing } = useFilterStore.getState();
    setIsProcessing(true);

    try {
      if ((filterType === "blur_bg" || filterType === "virtual_bg") && !this.segmenter) {
        this.segmenter = new SegmentationModel();
        await this.segmenter.initialize();
      }

      if (filterType === "face_mask" && !this.faceLandmarker) {
        this.faceLandmarker = new FaceLandmarkModel();
        await this.faceLandmarker.initialize();
      }
    } finally {
      setIsProcessing(false);
    }
  }

  startProcessing(): void {
    if (this.animFrameId) return;

    const processFrame = async (timestamp: number) => {
      const elapsed = timestamp - this.lastFrameTime;
      if (elapsed < this.TARGET_FRAME_TIME) {
        this.animFrameId = requestAnimationFrame(processFrame);
        return;
      }

      const startProcess = performance.now();
      const config = useFilterStore.getState();

      // Step 1: Draw source video or color-filtered video
      this.ctx.save();
      
      // Apply color filter logic via CSS filter context
      const colorFilterString = this.colorEffect.getFilterString(config);
      this.ctx.filter = colorFilterString;
      
      // Mirror the video horizontally (as typical for front cameras)
      this.ctx.translate(this.canvas.width, 0);
      this.ctx.scale(-1, 1);
      
      this.ctx.drawImage(this.sourceVideo, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();

      // Step 2: Apply AI Effects
      if (config.activeFilter === "blur_bg" || config.activeFilter === "virtual_bg") {
        if (this.segmenter) {
          const segResult = this.segmenter.segment(this.sourceVideo, timestamp);
          await this.bgEffect.apply(this.ctx, this.sourceVideo, segResult, config);
        }
      }

      if (config.activeFilter === "face_mask" && config.activeMasks.length > 0) {
        if (this.faceLandmarker) {
          const faceResult = this.faceLandmarker.detect(this.sourceVideo, timestamp);
          this.faceMaskEffect.apply(this.ctx, faceResult, config);
        }
      }

      // Auto-adjust FPS if processing is too slow
      const processTime = performance.now() - startProcess;
      if (processTime > 40) {
        this.TARGET_FRAME_TIME = 50; // drop to 20fps
      } else if (processTime < 25) {
        this.TARGET_FRAME_TIME = 33; // restore 30fps
      }

      this.lastFrameTime = timestamp;
      this.animFrameId = requestAnimationFrame(processFrame);
    };

    this.animFrameId = requestAnimationFrame(processFrame);
  }

  stopProcessing(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  getOutputStream(): MediaStream | null {
    return this.outputStream;
  }

  destroy(): void {
    this.stopProcessing();
    this.segmenter?.close();
    this.faceLandmarker?.close();
    this.outputStream?.getTracks().forEach((t) => t.stop());
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.sourceVideo.srcObject = null;
    this.sourceVideo.remove();
    
    this.segmenter = null;
    this.faceLandmarker = null;
    this.outputStream = null;
  }
}
