import { create } from "zustand";

interface MediaState {
  localStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  setLocalStream: (stream: MediaStream | null) => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  localStream: null,
  isAudioMuted: false,
  isVideoMuted: false,
  
  setLocalStream: (stream) => {
    set({ localStream: stream });
  },
  
  toggleAudio: () => {
    const { localStream, isAudioMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isAudioMuted; // Toggle if muted -> now enabled=true, meaning unmuted
      });
      set({ isAudioMuted: !isAudioMuted });
    }
  },
  
  toggleVideo: () => {
    const { localStream, isVideoMuted } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoMuted;
      });
      set({ isVideoMuted: !isVideoMuted });
    }
  }
}));
