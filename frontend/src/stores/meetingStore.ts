import { create } from "zustand";
import { Participant, WaitingUser, ChatMessage } from "@/types";

interface MeetingState {
  roomCode: string | null;
  status: 'idle' | 'waiting' | 'in-room' | 'ended';
  participants: Participant[];
  hostId: string | null;
  messages: ChatMessage[];
  waitingList: WaitingUser[];
  
  setRoomCode: (code: string | null) => void;
  setStatus: (status: 'idle' | 'waiting' | 'in-room' | 'ended') => void;
  setHostId: (id: string | null) => void;
  
  addParticipant: (p: Participant) => void;
  removeParticipant: (userId: string) => void;
  updateParticipantStream: (userId: string, stream: MediaStream) => void;
  
  addMessage: (msg: ChatMessage) => void;
  setWaitingList: (list: WaitingUser[]) => void;
  reset: () => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  roomCode: null,
  status: 'idle',
  participants: [],
  hostId: null,
  messages: [],
  waitingList: [],
  
  setRoomCode: (code) => set({ roomCode: code }),
  setStatus: (status) => set({ status }),
  setHostId: (hostId) => set({ hostId }),
  
  addParticipant: (p) => set((state) => {
    // Only add if not exist
    if (!state.participants.find(x => x.id === p.id)) {
      return { participants: [...state.participants, p] };
    }
    return state;
  }),
  
  removeParticipant: (userId) => set((state) => ({
    participants: state.participants.filter(p => p.id !== userId)
  })),
  
  updateParticipantStream: (userId, stream) => set((state) => ({
    participants: state.participants.map(p => 
      p.id === userId ? { ...p, stream } : p
    )
  })),
  
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setWaitingList: (list) => set({ waitingList: list }),
  
  reset: () => set({
    roomCode: null,
    status: 'idle',
    participants: [],
    hostId: null,
    messages: [],
    waitingList: [],
  })
}));
