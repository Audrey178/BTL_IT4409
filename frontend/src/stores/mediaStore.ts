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
    const { localStream } = get();

    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      set(state => ({ isAudioMuted: !state.isAudioMuted }));
    }
  },

  toggleVideo: () => {
    const { localStream } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      set(state => ({ isVideoMuted: !state.isVideoMuted }));
    }
  }
}));
