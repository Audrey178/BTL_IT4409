import { useEffect, useRef } from "react";
import { Room, Track } from "livekit-client";
import { useFilterStore } from "@/stores/filterStore";
import { VideoFilterProcessor } from "@/filters/VideoFilterProcessor";
import { useMediaStore } from "@/stores/mediaStore";

export function useVideoFilter(room: Room | null) {
  const processor = useRef<VideoFilterProcessor | null>(null);
  const activeFilter = useFilterStore((s) => s.activeFilter);
  const isSupported = useFilterStore((s) => s.isSupported);
  const prevFilter = useRef(activeFilter);

  useEffect(() => {
    // Basic browser support check
    if (!("WebAssembly" in window) || !HTMLCanvasElement.prototype.captureStream) {
      useFilterStore.getState().setIsSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!room?.localParticipant || !isSupported) return;

    const handleFilterChange = async () => {
      if (activeFilter !== "none" && prevFilter.current === "none") {
        // === ACTIVATE FILTER PIPELINE ===
        const cameraPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        const rawTrack = cameraPub?.track?.mediaStreamTrack;
        
        if (!rawTrack) {
            // Camera not ready yet. Just return and wait for it to be ready.
            return;
        }

        try {
          processor.current = new VideoFilterProcessor();
          const cameraStream = new MediaStream([rawTrack]);
          
          await processor.current.initialize(cameraStream);
          await processor.current.loadModels(activeFilter);
          processor.current.startProcessing();

          const processedStream = processor.current.getOutputStream();
          const canvasVideoTrack = processedStream?.getVideoTracks()[0];

          if (canvasVideoTrack) {
            await room.localParticipant.unpublishTrack(rawTrack);
            await room.localParticipant.publishTrack(canvasVideoTrack, {
              source: Track.Source.Camera,
              name: "filtered-camera",
            });
            // Update local stream in store to reflect filtered version
            useMediaStore.getState().setLocalStream(processedStream);
          }
        } catch (error) {
          console.error("Failed to apply video filter:", error);
          processor.current?.destroy();
          processor.current = null;
          useFilterStore.getState().setFilter("none");
        }

      } else if (activeFilter === "none" && prevFilter.current !== "none") {
        // === DEACTIVATE FILTER — restore raw camera ===
        processor.current?.destroy();
        processor.current = null;

        const isVideoMuted = useMediaStore.getState().isVideoMuted;
        if (!isVideoMuted) {
           await room.localParticipant.setCameraEnabled(false);
           await room.localParticipant.setCameraEnabled(true);
           
           // Fetch the new raw track and update media store
           const newCameraPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
           const newRawTrack = newCameraPub?.track?.mediaStreamTrack;
           if (newRawTrack) {
             useMediaStore.getState().setLocalStream(new MediaStream([newRawTrack]));
           }
        }
      } else if (activeFilter !== "none" && prevFilter.current !== "none") {
          // Changed from one filter to another (e.g., blur -> virtual bg)
          // We need to load models for the new filter type
          if (processor.current) {
              await processor.current.loadModels(activeFilter);
          }
      }

      prevFilter.current = activeFilter;
    };

    handleFilterChange();
  }, [activeFilter, room, isSupported, room?.localParticipant?.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      processor.current?.destroy();
    };
  }, []);
}
