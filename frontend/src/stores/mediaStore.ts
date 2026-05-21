import { create } from "zustand";

interface MediaState {
  localStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  screenStream: MediaStream | null;
  isScreenSharing: boolean;
  setLocalStream: (stream: MediaStream | null) => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  setScreenStream: (stream: MediaStream | null) => void;
  setIsScreenSharing: (v: boolean) => void;
  cleanup: () => void;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  localStream: null,
  isAudioMuted: false,
  isVideoMuted: false,
  screenStream: null,
  isScreenSharing: false,

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
  },

  setScreenStream: (stream) => {
    set({ screenStream: stream });
  },

  setIsScreenSharing: (v) => {
    set({ isScreenSharing: v });
  },

  cleanup: () => {
    const { localStream, screenStream } = get();
    localStream?.getTracks().forEach(t => t.stop());
    screenStream?.getTracks().forEach(t => t.stop());
    set({
      localStream: null,
      screenStream: null,
      isScreenSharing: false,
      isAudioMuted: false,
      isVideoMuted: false,
    });
  },
}));
