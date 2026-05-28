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
 *   1. Take the raw camera MediaStream from mediaStore (before any filter).
 *   2. Feed it into VideoFilterProcessor (Canvas AI pipeline).
 *   3. Publish the canvas track to LiveKit SFU, replacing the raw camera track.
 *   4. Update localStream in mediaStore for the local preview tile.
 *
 * Deactivation order is critical:
 *   a. Stop the canvas rendering loop (stopProcessing) — but do NOT yet stop
 *      the canvas output track (it is still being published!).
 *   b. Unpublish the canvas track from LiveKit SFU.
 *   c. Re-publish the saved raw camera track to SFU.
 *   d. Restore localStream to the raw stream.
 *   e. NOW fully destroy the processor (safe to stop canvas track).
 */
export function useVideoFilter(room: Room | null) {
  const processor = useRef<VideoFilterProcessor | null>(null);
  // Save the raw stream so we can restore it on deactivation
  const rawStreamRef = useRef<MediaStream | null>(null);

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

        // Save the raw stream reference — needed for clean restore on deactivation
        rawStreamRef.current = rawStream;

        try {
          processor.current = new VideoFilterProcessor();
          await processor.current.initialize(rawStream);
          await processor.current.loadModels(activeFilter);
          processor.current.startProcessing();

          const processedStream = processor.current.getOutputStream();
          if (!processedStream) return;

          const canvasVideoTrack = processedStream.getVideoTracks()[0];
          if (!canvasVideoTrack) return;

          // 1. Broadcast the filtered track to remote peers via LiveKit
          if (room?.localParticipant) {
            const localP = room.localParticipant;

            // Unpublish the current raw camera track from the SFU
            const cameraPub = localP.getTrackPublication(Track.Source.Camera);
            if (cameraPub?.track) {
              await localP.unpublishTrack(cameraPub.track);
            }

            // Publish the canvas-processed track as the camera source
            await localP.publishTrack(canvasVideoTrack, {
              source: Track.Source.Camera,
              name: "filtered-camera",
            });
          }

          // 2. Update local preview to show the filtered stream
          useMediaStore.getState().setLocalStream(processedStream);

        } catch (error) {
          console.error("Failed to start video filter:", error);
          processor.current?.destroy();
          processor.current = null;
          rawStreamRef.current = null;
          useFilterStore.getState().setFilter("none");
        }

      // ─────────────────────────────────────────────────────────────
      // DEACTIVATE: some filter → none
      // ORDER IS CRITICAL — swap tracks BEFORE destroying the processor.
      // processor.destroy() calls outputStream.getTracks().forEach(t.stop()),
      // which marks the canvas track as "ended". If the canvas track is still
      // published at that point, remote peers will see a permanent black frame.
      // ─────────────────────────────────────────────────────────────
      } else if (activeFilter === "none" && prevFilter.current !== "none") {

        // STEP 1: Stop the canvas rendering loop (new frames stop being drawn)
        //         but do NOT call destroy() yet — the canvas track is still published.
        processor.current?.stopProcessing();

        // STEP 2: Swap the track on the SFU BEFORE stopping the canvas track
        if (room?.localParticipant) {
          const localP = room.localParticipant;

          // Remove the canvas track from the SFU
          const canvasPub = localP.getTrackPublication(Track.Source.Camera);
          if (canvasPub?.track) {
            await localP.unpublishTrack(canvasPub.track);
          }

          // Re-publish the saved raw camera track
          const rawVideoTrack = rawStreamRef.current?.getVideoTracks()[0];
          if (rawVideoTrack && rawVideoTrack.readyState === "live") {
            await localP.publishTrack(rawVideoTrack, {
              source: Track.Source.Camera,
              name: "camera",
            });
          } else {
            // Fallback: raw track was lost somehow — let LiveKit acquire a fresh one
            console.warn("[useVideoFilter] Raw track gone, falling back to setCameraEnabled");
            await localP.setCameraEnabled(false);
            await localP.setCameraEnabled(true);
          }
        }

        // STEP 3: Restore local preview to the saved raw stream
        if (rawStreamRef.current) {
          useMediaStore.getState().setLocalStream(rawStreamRef.current);
          rawStreamRef.current = null;
        }

        // STEP 4: NOW fully destroy the processor — safe to stop the canvas track
        //         because it is no longer published to anyone.
        processor.current?.destroy();
        processor.current = null;

      // ─────────────────────────────────────────────────────────────
      // SWITCH: one AI filter → another AI filter
      // Canvas stream stays the same (same captureStream output).
      // Just load the new model; existing frames update automatically.
      // ─────────────────────────────────────────────────────────────
      } else if (activeFilter !== "none" && prevFilter.current !== "none") {
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
      processor.current?.stopProcessing();
      processor.current?.destroy();
    };
  }, []);
}
