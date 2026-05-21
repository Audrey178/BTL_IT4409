import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/socket/socket';
import { CHAT_EVENTS } from '@/socket/events';
import { useMeetingStore } from '@/stores/meetingStore';
import { useAuthStore } from '@/stores/useAuthStore';
import type { ChatMessage } from '@/types';

interface ChatHistoryResponse {
  messages: Array<{
    _id: string;
    sender_id: string;
    sender_name: string;
    content: string;
    type: 'text' | 'system' | 'file';
    timestamp: string;
  }>;
  page: number;
  hasMore: boolean;
}

interface ChatReceivePayload {
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  type?: 'text' | 'system' | 'file';
  timestamp: string;
  isOwn?: boolean;
}

/**
 * Hook xử lý toàn bộ chat socket events:
 * - Gửi tin nhắn qua `chat:send`
 * - Nhận tin nhắn qua `chat:receive`
 * - Load lịch sử chat qua `chat:history`
 *
 * Returns: { sendMessage, loadMoreHistory, hasMore, isLoadingHistory }
 */
export function useChatEvents(roomCode: string | null) {
  const socket = getSocket();
  const authUser = useAuthStore((s) => s.user);
  const { addMessage, setMessages, prependMessages } = useMeetingStore();

  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const isLoadingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  // --- Listen for incoming messages ---
  useEffect(() => {
    if (!roomCode) return;

    const handleReceive = (data: ChatReceivePayload) => {
      // Backend sends back to sender with isOwn=true.
      // We already add the message optimistically in sendMessage,
      // so skip the server echo for our own messages.
      if (data.isOwn) return;

      const msg: ChatMessage = {
        id: data.messageId,
        senderId: data.senderId,
        senderName: data.senderName,
        content: data.content,
        timestamp: data.timestamp,
        type: data.type ?? 'text',
      };
      addMessage(msg);
    };

    const handleSystemAlert = (data: { message: string; timestamp?: string }) => {
      const msg: ChatMessage = {
        id: `system-${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        content: data.message,
        timestamp: data.timestamp ?? new Date().toISOString(),
        type: 'system',
      };
      addMessage(msg);
    };

    socket.on(CHAT_EVENTS.RECEIVE, handleReceive);
    socket.on(CHAT_EVENTS.SYSTEM_ALERT, handleSystemAlert);

    return () => {
      socket.off(CHAT_EVENTS.RECEIVE, handleReceive);
      socket.off(CHAT_EVENTS.SYSTEM_ALERT, handleSystemAlert);
    };
  }, [socket, roomCode, addMessage]);

  // --- Listen for history response ---
  useEffect(() => {
    if (!roomCode) return;

    const handleHistory = (data: ChatHistoryResponse) => {
      isLoadingRef.current = false;
      hasMoreRef.current = data.hasMore;

      const mapped: ChatMessage[] = data.messages.map((m) => ({
        id: m._id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        content: m.content,
        timestamp: m.timestamp,
        type: m.type ?? 'text',
      }));

      if (data.page === 1) {
        setMessages(mapped);
      } else {
        prependMessages(mapped);
      }
    };

    socket.on(CHAT_EVENTS.HISTORY, handleHistory);

    return () => {
      socket.off(CHAT_EVENTS.HISTORY, handleHistory);
    };
  }, [socket, roomCode, setMessages, prependMessages]);

  // --- Initial history load ---
  useEffect(() => {
    if (!roomCode || initialLoadDoneRef.current) return;

    initialLoadDoneRef.current = true;
    pageRef.current = 1;
    isLoadingRef.current = true;

    socket.emit(CHAT_EVENTS.HISTORY, {
      roomCode,
      page: 1,
      limit: 50,
    });
  }, [socket, roomCode]);

  // --- Reset on unmount ---
  useEffect(() => {
    return () => {
      initialLoadDoneRef.current = false;
      pageRef.current = 1;
      hasMoreRef.current = true;
    };
  }, [roomCode]);

  // --- Send message ---
  const sendMessage = useCallback(
    (content: string) => {
      if (!roomCode || !content.trim()) return;

      const trimmed = content.trim();

      // Optimistic: add to store immediately
      const optimisticMsg: ChatMessage = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderId: authUser?._id ?? '',
        senderName: authUser?.full_name ?? 'You',
        content: trimmed,
        timestamp: new Date().toISOString(),
        type: 'text',
      };
      addMessage(optimisticMsg);

      // Emit to server
      socket.emit(CHAT_EVENTS.SEND, {
        roomCode,
        content: trimmed,
        type: 'text',
        senderName: authUser?.full_name ?? 'You',
        senderAvatar: null,
      });
    },
    [socket, roomCode, authUser, addMessage],
  );

  // --- Load older messages ---
  const loadMoreHistory = useCallback(() => {
    if (!roomCode || isLoadingRef.current || !hasMoreRef.current) return;

    isLoadingRef.current = true;
    pageRef.current += 1;

    socket.emit(CHAT_EVENTS.HISTORY, {
      roomCode,
      page: pageRef.current,
      limit: 50,
    });
  }, [socket, roomCode]);

  return {
    sendMessage,
    loadMoreHistory,
    hasMore: hasMoreRef.current,
  };
}
