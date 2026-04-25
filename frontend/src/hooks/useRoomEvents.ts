import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getSocket } from '@/socket/socket';
import { ROOM_EVENTS } from '@/socket/events';
import { useMeetingStore } from '@/stores/meetingStore';
import { useAuthStore } from '@/stores/useAuthStore';
import type { WaitingUser } from '@/types';

/**
 * Hook xử lý tất cả room-level socket events trong MeetingScreen.
 * Quản lý waiting list (host-side), user join/leave notifications,
 * force disconnect, và room ended events.
 */
export function useRoomEvents(roomCode: string | null) {
  const socket = getSocket();
  const navigate = useNavigate();
  const myUserId = useAuthStore((s) => s.user?._id);
  const {
    addWaitingUser,
    removeWaitingUser,
    addParticipant,
    removeParticipant,
    setStatus,
    reset,
  } = useMeetingStore();

  useEffect(() => {
    if (!roomCode || !myUserId) return;

    // Host receives approval requests from users trying to join
    const handleRequestApproval = (data: {
      userId: string;
      memberId: string;
      userName?: string;
      message?: string;
    }) => {
      const waitingUser: WaitingUser = {
        id: data.userId,
        fullName: data.userName || 'Unknown User',
        socketId: '',
        memberId: data.memberId,
      };
      addWaitingUser(waitingUser);
      toast.info(`${waitingUser.fullName} is requesting to join`);
    };

    // Khi user được approve và join vào room
    const handleUserJoined = (data: {
      userId: string;
      userName?: string;
      user?: { _id: string; fullName?: string; full_name?: string };
      message?: string;
      isSelf?: boolean;
      existingParticipants?: Array<{ userId: string; userName: string }>;
    }) => {
      // isSelf: cho approved user — useWebRTC xử lý WebRTC peers,
      // ở đây chỉ cập nhật status
      if (data.isSelf) {
        setStatus('in-room');

        // Add existing participants vào store
        if (data.existingParticipants) {
          data.existingParticipants.forEach(p => {
            addParticipant({
              id: p.userId,
              fullName: p.userName,
              isActive: true,
              isAudioMuted: false,
              isVideoMuted: false,
            });
          });
        }
        toast.success('Bạn đã được chấp nhận vào phòng!');
        return;
      }

      const uId = data.userId || data.user?._id;
      if (!uId) return;

      // Bỏ qua nếu là chính mình (trường hợp broadcast)
      if (uId === myUserId) return;

      const fullName =
        data.userName ||
        data.user?.fullName ||
        data.user?.full_name ||
        'Guest';

      // Xóa khỏi waiting list (host-side) và thêm vào participants
      removeWaitingUser(uId);
      addParticipant({
        id: uId,
        fullName,
        isActive: true,
        isAudioMuted: false,
        isVideoMuted: false,
      });

      toast.success(`${fullName} đã tham gia phòng họp`);
    };

    // Khi user rời phòng
    const handleUserLeft = (data: { userId: string; message?: string }) => {
      if (data.userId && data.userId !== myUserId) {
        removeParticipant(data.userId);
      }
    };

    // Host rejects a user
    const handleUserRejected = (data: {
      memberId?: string;
      userId?: string;
      message?: string;
    }) => {
      if (data.userId) {
        removeWaitingUser(data.userId);
      }
    };

    // Force disconnect (kicked)
    const handleForceDisconnect = () => {
      toast.error('You have been removed from the meeting');
      reset();
      navigate('/', { replace: true });
    };

    // Room ended by host
    const handleRoomEnded = () => {
      toast.info('The meeting has ended');
      setStatus('ended');
      reset();
      navigate('/', { replace: true });
    };

    socket.on(ROOM_EVENTS.REQUEST_APPROVAL, handleRequestApproval);
    socket.on(ROOM_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(ROOM_EVENTS.USER_LEFT, handleUserLeft);
    socket.on(ROOM_EVENTS.USER_REJECTED, handleUserRejected);
    socket.on(ROOM_EVENTS.FORCE_DISCONNECT, handleForceDisconnect);
    socket.on(ROOM_EVENTS.ENDED, handleRoomEnded);

    return () => {
      socket.off(ROOM_EVENTS.REQUEST_APPROVAL, handleRequestApproval);
      socket.off(ROOM_EVENTS.USER_JOINED, handleUserJoined);
      socket.off(ROOM_EVENTS.USER_LEFT, handleUserLeft);
      socket.off(ROOM_EVENTS.USER_REJECTED, handleUserRejected);
      socket.off(ROOM_EVENTS.FORCE_DISCONNECT, handleForceDisconnect);
      socket.off(ROOM_EVENTS.ENDED, handleRoomEnded);
    };
  }, [
    socket,
    roomCode,
    myUserId,
    addWaitingUser,
    removeWaitingUser,
    addParticipant,
    removeParticipant,
    setStatus,
    reset,
    navigate,
  ]);
}
