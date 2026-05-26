import { create } from "zustand";
import { Participant, WaitingUser, ChatMessage } from "@/types";

interface MeetingState {
  roomCode: string | null;
  status: 'idle' | 'waiting' | 'in-room' | 'ended';
  participants: Participant[];
  hostId: string | null;
  memberId: string | null;
  isHost: boolean;
  messages: ChatMessage[];
  waitingList: WaitingUser[];
  screenSharingUserId: string | null;
  isRecording: boolean;

  setRoomCode: (code: string | null) => void;
  setStatus: (status: 'idle' | 'waiting' | 'in-room' | 'ended') => void;
  setHostId: (id: string | null) => void;
  setIsHost: (v: boolean) => void;
  setMemberId: (id: string | null) => void;
  setIsRecording: (v: boolean) => void;

  addParticipant: (p: Participant) => void;
  removeParticipant: (userId: string) => void;
  updateParticipantStream: (userId: string, stream: MediaStream) => void;
  updateParticipantMedia: (userId: string, patch: { isAudioMuted?: boolean; isVideoMuted?: boolean }) => void;
  updateParticipantScreenStream: (userId: string, stream: MediaStream) => void;
  clearParticipantScreenStream: (userId: string) => void;

  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  prependMessages: (msgs: ChatMessage[]) => void;

  setWaitingList: (list: WaitingUser[]) => void;
  addWaitingUser: (user: WaitingUser) => void;
  removeWaitingUser: (userId: string) => void;

  setScreenSharingUserId: (userId: string | null) => void;

  reset: () => void;
}

const initialState = {
  roomCode: null,
  status: 'idle' as const,
  participants: [],
  hostId: null,
  isHost: false,
  memberId: null,
  messages: [],
  waitingList: [],
  screenSharingUserId: null,
  isRecording: false,
};

export const useMeetingStore = create<MeetingState>((set) => ({
  ...initialState,

  setRoomCode: (code) => set({ roomCode: code }),
  setStatus: (status) => set({ status }),
  setHostId: (hostId) => set({ hostId }),
  setIsHost: (v) => set({ isHost: v }),
  setMemberId: (memberId) => set({ memberId }),
  setIsRecording: (isRecording) => set({ isRecording }),

  addParticipant: (p) => set((state) => {
    // Only add if not exist
    if (!state.participants.find(x => x.id === p.id)) {
      return { participants: [...state.participants, p] };
    }
    return state;
  }),

  removeParticipant: (userId) => set((state) => ({
    participants: state.participants.filter(p => p.id !== userId),
    // Clear screen sharing if the user who left was sharing
    screenSharingUserId: state.screenSharingUserId === userId ? null : state.screenSharingUserId,
  })),

  updateParticipantStream: (userId, stream) => set((state) => ({
    participants: state.participants.map(p =>
      p.id === userId ? { ...p, stream } : p
    )
  })),

  updateParticipantMedia: (userId, patch) => set((state) => ({
    participants: state.participants.map(p =>
      p.id === userId ? { ...p, ...patch } : p
    )
  })),

  updateParticipantScreenStream: (userId, screenStream) => set((state) => ({
    participants: state.participants.map(p =>
      p.id === userId ? { ...p, screenStream } : p
    )
  })),

  clearParticipantScreenStream: (userId) => set((state) => ({
    participants: state.participants.map(p =>
      p.id === userId ? { ...p, screenStream: undefined } : p
    )
  })),

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),
  prependMessages: (msgs) => set((state) => ({ messages: [...msgs, ...state.messages] })),

  setWaitingList: (list) => set({ waitingList: list }),

  addWaitingUser: (user) => set((state) => {
    if (!state.waitingList.find(u => u.id === user.id)) {
      return { waitingList: [...state.waitingList, user] };
    }
    return state;
  }),

  removeWaitingUser: (userId) => set((state) => ({
    waitingList: state.waitingList.filter(u => u.id !== userId)
  })),

  setScreenSharingUserId: (userId) => set({ screenSharingUserId: userId }),

  reset: () => set(initialState),
}));
