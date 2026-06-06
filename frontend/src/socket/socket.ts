import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/useAuthStore';

let socket: Socket | null = null;

// BẢN SỬA LỖI
export function getSocket(): Socket {
  if (!socket) {
    // Thay đổi '/' thành import.meta.env.VITE_API_URL (hoặc tên biến bạn dùng cho URL Render)
    const SOCKET_URL = import.meta.env.MODE === 'development'
      ? 'http://localhost:3000'
      : import.meta.env.VITE_API_URL; // TRỎ ĐÍCH DANH VỀ RENDER

    const user = useAuthStore.getState().user;

    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: { token: useAuthStore.getState().accessToken },
      query: { userId: user?._id || '' },
      transports: ['websocket', 'polling'], // Giữ nguyên, rất tốt cho môi trường cloud
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
