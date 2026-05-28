# Real-Time AI Video Filter Architecture

## 1. High-Level Overview
The AI Video Filter feature provides real-time video augmentation for the WebRTC video calling application. It enables users to apply background blur, virtual backgrounds, and AR face masks (stickers) directly to their webcam feed before it is transmitted to other participants.

The system leverages the following core technologies:
- **MediaPipe Tasks Vision (`@mediapipe/tasks-vision`)**: Provides lightweight, WebAssembly (WASM)-accelerated on-device machine learning models for Image Segmentation (`selfie_segmenter`) and Face Landmarking.
- **HTML5 Canvas 2D API**: Used as the rendering engine to composite the raw video frames with AI-generated masks and effects.
- **WebRTC (`captureStream`)**: Converts the `<canvas>` rendering output back into a standard `MediaStreamTrack` that can be published to the LiveKit room.
- **Zustand (`filterStore`)**: Manages the application state (active filters, intensities, loaded masks) independently of React's rendering cycle to ensure high-performance video processing without frame drops.

---

## 2. Architecture Diagram

The following diagram illustrates the complete data pipeline from the user's raw webcam feed to the processed WebRTC output.

```mermaid
flowchart TD
    subgraph Input
        A[Webcam MediaStream] --> B[Hidden HTMLVideoElement]
    end

    subgraph Processing Loop (requestAnimationFrame)
        B --> C{Read Video Frame}
        
        C --> D[Draw to Main Canvas\nwith CSS Color Filters]
        
        C --> E[MediaPipe WASM Models]
        E -->|selfie_segmenter| F[ImageSegmenterResult\nCategory Mask]
        E -->|face_landmarker| G[FaceLandmarkerResult\nLandmarks]
        
        F --> H[BackgroundEffect.ts\nPixel Compositing]
        G --> I[FaceMaskEffect.ts\nAR Overlay Drawing]
        
        D --> H
        H --> I
        I --> J[Final Canvas Output]
    end

    subgraph Output
        J --> K[canvas.captureStream 30 FPS]
        K --> L[Update Local MediaStore]
        L --> M[LiveKit PublishTrack\n& Local VideoTile Preview]
    end
```

---

## 3. Core Components Explanation

### `VideoFilterProcessor.ts`
This is the main engine coordinating the entire pipeline. It encapsulates the hidden `<video>` element, the `<canvas>`, and the `requestAnimationFrame` (RAF) loop.
- **Initialization**: Takes the raw `MediaStream`, assigns it to the hidden video, and sets up `canvas.captureStream()`.
- **The RAF Loop (`startProcessing`)**: Executes continuously to pull the latest video frame, apply CSS-based color filters via `ctx.filter`, and orchestrate the AI effects. It includes dynamic FPS adjustment (throttling to 20fps if processing time exceeds 40ms) to prevent UI thread freezing on lower-end devices.

### `BackgroundEffect.ts`
Handles background blurring and virtual background replacement using segmentation masks.
- **Segmentation Logic**: The MediaPipe `selfie_segmenter` outputs a `categoryMask` where `0` represents the person (foreground) and `255` represents the background.
- **Compositing**: It reads the raw canvas pixels using `getImageData()`. It draws either a blurred version of the frame or a virtual background image onto a hidden, temporary canvas. By iterating through the `categoryMask`, it selectively overwrites pixels in the main canvas where `mask[i] > 127` (the background), preserving the person.

### `FaceMaskEffect.ts`
Handles drawing AR stickers (e.g., glasses, hats) anchored to the user's facial features.
- **Coordinate Mapping**: MediaPipe provides normalized `[0, 1]` coordinates. These are mapped directly to the un-mirrored canvas dimensions.
- **Scaling Algorithm**: To ensure stickers scale naturally as the user moves closer or further from the camera, the effect calculates the `faceWidth` (the pixel distance between the inner corners of the eyes: landmarks 33 and 263). The mask width is calculated as a multiple of this `faceWidth` (`drawW = faceWidth * maskConfig.scale`), independent of the source PNG resolution.
- **Compositing Integrity**: It explicitly resets `ctx.filter = "none"` and sets `ctx.globalCompositeOperation = "source-over"` before drawing. This ensures that PNG transparency is respected and that CSS color filters (applied earlier in the pipeline) do not tint the AR masks.

---

## 4. State Management (`filterStore`)

Video processing requires a sustained 30 frames per second. If the processing loop relied on standard React state (`useState`), every filter adjustment would trigger a component re-render, leading to stuttering and frame drops.

To solve this, the pipeline reads configuration directly from a Zustand store (`useFilterStore.getState()`) inside the `requestAnimationFrame` loop.
- **Zero React Re-renders**: When a user changes the blur intensity or toggles an AR mask, Zustand updates its internal state. The RAF loop reads this updated state on the very next frame (`const config = useFilterStore.getState();`) and applies the changes instantly without triggering any React lifecycle methods.
- **Decoupled Architecture**: The UI components only dispatch actions to the store, and the Canvas pipeline only reads from the store, keeping the presentation layer completely decoupled from the heavy processing logic.

---

## 5. Performance & Memory Management

Real-time AI video processing is resource-intensive. The following optimizations are implemented to maintain stability and prevent memory leaks:

- **Lazy Loading & Caching**: MediaPipe WASM models and model weights (`.tflite` files) are only loaded into memory when the user activates an AI filter for the first time. Background images and AR mask PNGs are preloaded and cached in memory `Map`s to prevent redundant network requests.
- **Canvas `willReadFrequently`**: The 2D contexts for both the main and temporary canvases are initialized with `{ willReadFrequently: true }`. This signals the browser to optimize for frequent `getImageData()` calls (which are required for background segmentation), preventing GPU-to-CPU memory transfer bottlenecks.
- **Adaptive FPS Throttling**: The processor measures the execution time of each frame. If a frame takes too long to render (indicating thermal throttling or a slow device), it automatically drops the target frame rate from 30 FPS to 20 FPS to maintain a smooth, albeit slower, visual experience.
- **Graceful Teardown (`destroy`)**: When the filter is disabled or the component unmounts, the `destroy()` method explicitly cancels the `requestAnimationFrame` loop, calls `.close()` on the MediaPipe models to free WASM memory, stops all media tracks (`outputStream.getTracks().forEach(t => t.stop())`), and clears the `<video>` source to allow proper garbage collection.
