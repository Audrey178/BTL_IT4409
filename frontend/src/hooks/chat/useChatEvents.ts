import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
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
    attachment?: {
      url: string;
      filename: string;
      storedFilename?: string;
      mime_type?: string;
      size?: number;
    } | null;
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
  attachment?: {
    url: string;
    filename: string;
    storedFilename?: string;
    mime_type?: string;
    size?: number;
  } | null;
  clientId?: string;
  client_id?: string;
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
  const upsertMessage = useMeetingStore((s) => s.upsertMessage);

  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const isLoadingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  // --- Listen for incoming messages ---
  useEffect(() => {
    if (!roomCode) return;

    const handleReceive = (data: ChatReceivePayload) => {
      // If server returns a clientId, replace any optimistic message that used that clientId.
      const msg: ChatMessage = {
        id: data.messageId,
        senderId: data.senderId,
        senderName: data.senderName,
        content: data.content,
        timestamp: data.timestamp,
        type: data.type ?? 'text',
        attachment: data.attachment ?? null,
        // preserve clientId for upsert matching
        // @ts-ignore
        clientId: data.clientId || data.client_id || null,
      } as any;

      if (msg.senderId && msg.senderId !== authUser?._id) {
        const preview = msg.type === 'file'
          ? msg.attachment?.filename || msg.content || 'Attachment'
          : msg.type === 'emoji'
            ? msg.content
            : msg.content;
        try {
          toast.info(`Tin nhắn mới từ ${msg.senderName}`, {
            description: preview,
          });
        } catch (e) {}
      }

      if (data.clientId || (data as any).client_id) {
        console.log('[CHAT RECEIVE] upsert by clientId', { clientId: data.clientId || (data as any).client_id, content: data.content });
        upsertMessage(msg);
        return;
      }

      // Fallback: just append message
      console.log('[CHAT RECEIVE] append', { messageId: data.messageId, content: data.content });
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
        attachment: m.attachment ?? null,
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
    (payload: string | any) => {
      if (!roomCode) return;

      // If payload is a plain string, treat as text
      if (typeof payload === 'string') {
        const content = payload.trim();
        if (!content) return;

        const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const optimisticMsg: ChatMessage = {
          id: localId,
          // keep clientId for upsert matching
          // @ts-ignore
          clientId: localId,
          senderId: authUser?._id ?? '',
          senderName: authUser?.full_name ?? 'You',
          content,
          timestamp: new Date().toISOString(),
          type: 'text',
        };
        addMessage(optimisticMsg);

        socket.emit(CHAT_EVENTS.SEND, {
          roomCode,
          content,
          type: 'text',
          senderName: authUser?.full_name ?? 'You',
          senderAvatar: null,
          clientId: localId,
          client_id: localId,
        });

        return;
      }

      // Otherwise payload is an object with richer fields
      const data = payload || {};
      const localId = data.clientId || data.client_id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // allow empty content for file/sticker/emoji
      const optimisticMsg: ChatMessage = {
        id: localId,
        // keep clientId on optimistic message so upsert can match server echo
        // @ts-ignore
        clientId: localId,
        senderId: authUser?._id ?? '',
        senderName: authUser?.full_name ?? 'You',
        content:
          data.type === 'file'
            ? (data.attachment?.filename || data.attachment?.url || '')
            : (data.content || '') as string,
        timestamp: new Date().toISOString(),
        type: (data.type as any) || 'text',
        attachment: data.attachment ?? null,
      };
      addMessage(optimisticMsg);

      const normalizedPayload = {
        roomCode,
        ...data,
        clientId: data.clientId || data.client_id || localId,
        // also include legacy snake_case for server compatibility
        client_id: data.clientId || data.client_id || localId,
        senderName: authUser?.full_name ?? 'You',
        senderAvatar: null,
        // file messages should not carry a caption; content is only a display label
        content: data.type === 'file' ? (data.attachment?.filename || data.attachment?.url || '') : data.content,
      };

        console.log('[CHAT SEND] emit', { payload: normalizedPayload });
        socket.emit(CHAT_EVENTS.SEND, {
          ...normalizedPayload,
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
