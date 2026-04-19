import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/useAuthStore';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const SOCKET_URL = import.meta.env.MODE === 'development' 
      ? 'http://localhost:3000' 
      : '/'; // Change to the correct production URL
      
    // Create socket with auth token
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: { token: useAuthStore.getState().accessToken },
      transports: ['websocket', 'polling'], // Use polling fallback
    });
  }
  return socket;
}

export function connectSocket() {
  const skt = getSocket();
  if (!skt.connected) {
    skt.connect();
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
