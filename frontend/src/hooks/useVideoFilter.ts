import { useEffect, useRef } from "react";
import { Track } from "livekit-client";
import type { Room, LocalVideoTrack } from "livekit-client";
import { useFilterStore } from "@/stores/filterStore";
import { VideoFilterProcessor } from "@/filters/VideoFilterProcessor";
import { useMediaStore } from "@/stores/mediaStore";

/**
 * useVideoFilter
 *
 * Applies AI/canvas-based video filters to the local camera stream using
 * LiveKit's `LocalVideoTrack.replaceTrack()` to swap the underlying
 * MediaStreamTrack on the existing SFU publication without disconnecting.
 *
 * Architecture:
 *   ACTIVATION (none → filter):
 *     1. Grab the existing LiveKit LocalVideoTrack + its raw MediaStreamTrack.
 *     2. Start the Canvas AI pipeline using the raw track as input.
 *     3. Call `localVideoTrack.replaceTrack(canvasTrack)` — the SFU sender
 *        now forwards the canvas frames to all remote peers instantly.
 *     4. Update localStream in mediaStore for the local preview.
 *
 *   DEACTIVATION (filter → none):
 *     1. Call `localVideoTrack.replaceTrack(originalRawTrack)` FIRST —
 *        the SFU sender is back on the raw camera. Do this BEFORE stopping
 *        the canvas pipeline so remote peers never see a black frame.
 *     2. Destroy the processor (now safe to stop the canvas track).
 *     3. Update localStream to show the raw camera again.
 *
 *   SWITCH (filter A → filter B):
 *     The canvas stream stays the same object (same captureStream output).
 *     Just load the new AI model; the existing replaced track carries new frames.
 */
export function useVideoFilter(room: Room | null) {
  const processor = useRef<VideoFilterProcessor | null>(null);

  // The original raw camera MediaStreamTrack — kept alive while filter is active
  // so we can replaceTrack() back to it on deactivation.
  const originalRawTrackRef = useRef<MediaStreamTrack | null>(null);

  // The LiveKit LocalVideoTrack instance — we call replaceTrack() on this.
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);

  const activeFilter = useFilterStore((s) => s.activeFilter);
  const isSupported = useFilterStore((s) => s.isSupported);
  const prevFilter = useRef(activeFilter);

  // One-time browser support check
  useEffect(() => {
    if (!("WebAssembly" in window) || !HTMLCanvasElement.prototype.captureStream) {
      useFilterStore.getState().setIsSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    const handleFilterChange = async () => {

      // ─────────────────────────────────────────────────────────────
      // ACTIVATE: none → some filter
      // ─────────────────────────────────────────────────────────────
      if (activeFilter !== "none" && prevFilter.current === "none") {
        if (!room?.localParticipant) {
          prevFilter.current = activeFilter;
          return;
        }

        const cameraPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        const localVideoTrack = cameraPub?.videoTrack as LocalVideoTrack | undefined;

        if (!localVideoTrack || !localVideoTrack.mediaStreamTrack) {
          console.warn("[useVideoFilter] Camera publication not found, cannot activate filter.");
          prevFilter.current = activeFilter;
          return;
        }

        // Save the current raw track so we can restore it on deactivation.
        // Important: save BEFORE calling replaceTrack, because after replaceTrack
        // localVideoTrack.mediaStreamTrack points to the new canvas track.
        const rawTrack = localVideoTrack.mediaStreamTrack;
        originalRawTrackRef.current = rawTrack;
        localVideoTrackRef.current = localVideoTrack;

        try {
          // Build a MediaStream from the raw track to feed into the canvas pipeline
          const rawStream = new MediaStream([rawTrack]);

          // Grab the mic track (if available) to pass through the canvas pipeline audio
          const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
          if (micPub?.track?.mediaStreamTrack) {
            rawStream.addTrack(micPub.track.mediaStreamTrack);
          }

          processor.current = new VideoFilterProcessor();
          await processor.current.initialize(rawStream);
          await processor.current.loadModels(activeFilter);
          processor.current.startProcessing();

          const processedStream = processor.current.getOutputStream();
          const canvasVideoTrack = processedStream?.getVideoTracks()[0];

          if (!processedStream || !canvasVideoTrack) {
            throw new Error("[useVideoFilter] Canvas pipeline produced no video track.");
          }

          // Replace the track inside the EXISTING SFU publication.
          // This does NOT unpublish/republish — it just swaps the MediaStreamTrack
          // at the RTCRtpSender level. Remote peers seamlessly receive canvas frames.
          await localVideoTrack.replaceTrack(canvasVideoTrack);

          // Update local preview to show the filtered stream
          useMediaStore.getState().setLocalStream(processedStream);

        } catch (error) {
          console.error("[useVideoFilter] Failed to activate filter:", error);
          // Teardown on failure
          processor.current?.destroy();
          processor.current = null;
          originalRawTrackRef.current = null;
          localVideoTrackRef.current = null;
          useFilterStore.getState().setFilter("none");
        }

      // ─────────────────────────────────────────────────────────────
      // DEACTIVATE: some filter → none
      //
      // ORDER IS CRITICAL:
      //   replaceTrack(rawTrack) FIRST  → SFU is back on raw camera
      //   processor.destroy() AFTER     → now safe to stop canvas track
      // ─────────────────────────────────────────────────────────────
      } else if (activeFilter === "none" && prevFilter.current !== "none") {
        const localVideoTrack = localVideoTrackRef.current;
        const rawTrack = originalRawTrackRef.current;

        // STEP 1: Restore the raw camera track in the RTCRtpSender FIRST.
        // After this call, remote peers receive raw camera frames again.
        // The canvas track is still "live" at this point (not yet stopped).
        if (localVideoTrack && rawTrack && rawTrack.readyState === "live") {
          try {
            await localVideoTrack.replaceTrack(rawTrack);
          } catch (err) {
            console.error("[useVideoFilter] replaceTrack back to raw failed:", err);
          }
        } else if (localVideoTrack) {
          // Edge case: raw track ended (e.g. camera was toggled while filter active).
          // Fall back to letting LiveKit re-acquire the camera.
          console.warn("[useVideoFilter] Original raw track is gone, using setCameraEnabled fallback.");
          await room?.localParticipant?.setCameraEnabled(false);
          await room?.localParticipant?.setCameraEnabled(true);
        }

        // STEP 2: NOW safe to destroy the processor.
        // processor.destroy() stops the canvas output track — this is OK because
        // the RTCRtpSender no longer references it (we swapped back in step 1).
        processor.current?.destroy();
        processor.current = null;

        // STEP 3: Update local preview to show the raw camera stream
        if (rawTrack && rawTrack.readyState === "live") {
          useMediaStore.getState().setLocalStream(new MediaStream([rawTrack]));
        } else if (room?.localParticipant) {
          // Build a fresh stream from whatever LiveKit has now
          const tracks: MediaStreamTrack[] = [];
          [Track.Source.Camera, Track.Source.Microphone].forEach((src) => {
            const pub = room.localParticipant.getTrackPublication(src);
            if (pub?.track?.mediaStreamTrack) tracks.push(pub.track.mediaStreamTrack);
          });
          if (tracks.length) useMediaStore.getState().setLocalStream(new MediaStream(tracks));
        }

        // Clear saved refs
        originalRawTrackRef.current = null;
        localVideoTrackRef.current = null;

      // ─────────────────────────────────────────────────────────────
      // SWITCH: filter A → filter B
      // The canvas MediaStream / replaceTrack'd track stays the same object.
      // Just swap the AI model — new frames will appear in the existing sender.
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

  // Cleanup on unmount: restore raw track if filter is active, then destroy
  useEffect(() => {
    return () => {
      const localVT = localVideoTrackRef.current;
      const rawTrack = originalRawTrackRef.current;
      if (localVT && rawTrack && rawTrack.readyState === "live") {
        // Synchronous — replaceTrack is async but we do our best on unmount
        localVT.replaceTrack(rawTrack).catch(() => {});
      }
      processor.current?.destroy();
    };
  }, []);
}
