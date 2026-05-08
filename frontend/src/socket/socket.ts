import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/useAuthStore';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const SOCKET_URL =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.MODE === 'development' ? 'http://localhost:3000' : '/');
      
    // Create socket with auth token
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: { token: useAuthStore.getState().accessToken },
      transports: ['websocket', 'polling'], // Use polling fallback
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Error handling
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected the socket, reconnect
        socket?.connect();
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
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
