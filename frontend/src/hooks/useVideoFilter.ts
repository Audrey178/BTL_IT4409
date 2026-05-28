import { useEffect, useRef } from "react";
import { Track } from "livekit-client";
import type { Room } from "livekit-client";
import { useFilterStore } from "@/stores/filterStore";
import { VideoFilterProcessor } from "@/filters/VideoFilterProcessor";
import { useMediaStore } from "@/stores/mediaStore";

/**
 * useVideoFilter
 *
 * Applies AI/canvas-based video filters and broadcasts them to remote peers.
 *
 * Strategy:
 *   1. Take the raw camera MediaStream from mediaStore.
 *   2. Feed it into VideoFilterProcessor (Canvas AI pipeline).
 *   3. Replace localStream in mediaStore → updates local preview tile.
 *   4. ALSO replace the published LiveKit track via unpublish/publish so
 *      remote peers receive the filtered canvas stream instead of raw camera.
 *
 * On deactivation, restores the original camera track via setCameraEnabled().
 */
export function useVideoFilter(room: Room | null) {
  const processor = useRef<VideoFilterProcessor | null>(null);
  // Store the canvas MediaStreamTrack we published, so we can unpublish it later
  const publishedCanvasTrackRef = useRef<MediaStreamTrack | null>(null);

  const activeFilter = useFilterStore((s) => s.activeFilter);
  const isSupported = useFilterStore((s) => s.isSupported);
  const prevFilter = useRef(activeFilter);

  // Browser support check (once on mount)
  useEffect(() => {
    if (!("WebAssembly" in window) || !HTMLCanvasElement.prototype.captureStream) {
      useFilterStore.getState().setIsSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    const handleFilterChange = async () => {
      const mediaState = useMediaStore.getState();

      // ─────────────────────────────────────────────────────────────
      // ACTIVATE: none → some filter
      // ─────────────────────────────────────────────────────────────
      if (activeFilter !== "none" && prevFilter.current === "none") {
        const rawStream = mediaState.localStream;
        if (!rawStream || rawStream.getVideoTracks().length === 0) {
          prevFilter.current = activeFilter;
          return;
        }

        try {
          processor.current = new VideoFilterProcessor();
          await processor.current.initialize(rawStream);
          await processor.current.loadModels(activeFilter);
          processor.current.startProcessing();

          const processedStream = processor.current.getOutputStream();
          if (!processedStream) return;

          const canvasVideoTrack = processedStream.getVideoTracks()[0];

          // 1. Update local preview immediately
          useMediaStore.getState().setLocalStream(processedStream);

          // 2. Broadcast the canvas track to remote peers via LiveKit
          if (room?.localParticipant && canvasVideoTrack) {
            const localP = room.localParticipant;

            // Unpublish the current raw camera track
            const cameraPub = localP.getTrackPublication(Track.Source.Camera);
            if (cameraPub?.track) {
              await localP.unpublishTrack(cameraPub.track);
            }

            // Publish the canvas-processed track as the camera source
            await localP.publishTrack(canvasVideoTrack, {
              source: Track.Source.Camera,
              name: "filtered-camera",
            });

            // Remember the canvas track so we can clean it up later
            publishedCanvasTrackRef.current = canvasVideoTrack;
          }
        } catch (error) {
          console.error("Failed to start video filter:", error);
          processor.current?.destroy();
          processor.current = null;
          publishedCanvasTrackRef.current = null;
          useFilterStore.getState().setFilter("none");
        }

      // ─────────────────────────────────────────────────────────────
      // DEACTIVATE: some filter → none
      // ─────────────────────────────────────────────────────────────
      } else if (activeFilter === "none" && prevFilter.current !== "none") {
        // === DEACTIVATE FILTER ===
        //
        // ORDER IS CRITICAL:
        // 1. Unpublish canvas track FIRST — before stopping it.
        //    If we call destroy() first, the canvas MediaStreamTrack is stopped
        //    while still published → LiveKit sends a black frame to remote peers.
        // 2. Destroy the canvas pipeline (now safe to stop the track).
        // 3. Re-enable real camera — LiveKit re-acquires and publishes fresh raw track.
        //    The handleLocalTrackPublished event in useLiveKit.ts will automatically
        //    update localStream in mediaStore once the new camera track is published.

        if (room?.localParticipant) {
          const localP = room.localParticipant;
          const isCameraOff = useMediaStore.getState().isVideoMuted;

          // Step 1: Unpublish the canvas track cleanly BEFORE stopping it
          const canvasPub = localP.getTrackPublication(Track.Source.Camera);
          if (canvasPub?.track) {
            await localP.unpublishTrack(canvasPub.track);
          }

          // Step 2: Now safe to destroy the pipeline (stops canvas track)
          processor.current?.destroy();
          processor.current = null;
          publishedCanvasTrackRef.current = null;

          // Step 3: Re-enable the real camera if it's not muted
          if (!isCameraOff) {
            await localP.setCameraEnabled(true);
          }
        } else {
          // No room available — just clean up the processor
          processor.current?.destroy();
          processor.current = null;
          publishedCanvasTrackRef.current = null;
        }

      // ─────────────────────────────────────────────────────────────
      // SWITCH: one AI filter → another AI filter
      // ─────────────────────────────────────────────────────────────
      } else if (activeFilter !== "none" && prevFilter.current !== "none") {
        // The canvas stream object stays the same (same captureStream output).
        // We only need to load the new model; the existing published track
        // continues to carry the updated frames automatically.
        if (processor.current) {
          await processor.current.loadModels(activeFilter);
        }
      }

      prevFilter.current = activeFilter;
    };

    handleFilterChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, isSupported, room]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      processor.current?.destroy();
    };
  }, []);
}
