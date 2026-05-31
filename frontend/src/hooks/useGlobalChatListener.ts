import { useEffect } from 'react';
import { getSocket } from '@/socket/socket';
import { CHAT_EVENTS } from '@/socket/events';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMessageStore } from '@/stores/messageStore';

export function useGlobalChatListener() {
  const authUser = useAuthStore((s) => s.user);
  const upsertMessage = useMessageStore((s) => s.upsertMessage);
  const incrementUnread = useMessageStore((s) => s.incrementUnread);
  const activeConversationId = useMessageStore((s) => s.activeConversationId);
  // notifications removed: we now rely on unread counts in message store

  useEffect(() => {
    const socket = getSocket();
    const subscribed = new Set<string>();
    const handler = (data: any) => {
      try {
        const conversationId = data.conversationId || data.conversation_id || data.roomId || null;
        if (!conversationId) return;

        const message = {
          messageId: data.messageId || data._id || data.id,
          conversationId,
          senderId: data.senderId || data.sender_id,
          senderName: data.senderName || data.sender_name,
          content: data.content,
          type: data.type || 'text',
          timestamp: data.timestamp || new Date().toISOString(),
          attachment: data.attachment || null,
          clientId: data.clientId || data.client_id || null,
        } as any;

        // upsert into store
        upsertMessage(conversationId, message);

        // increment unread when recipient is not the sender
        if (message.senderId && authUser?._id && message.senderId !== authUser._id) {
          if (conversationId !== activeConversationId) {
            incrementUnread(conversationId);
          }
        }
      } catch (e) {
        console.error('global listener error', e);
      }
    };

    socket.on(CHAT_EVENTS.RECEIVE, handler);

    // Subscribe to all known conversations so server will deliver receives even when user is not viewing messages page
    const unsubConvos = () => {
      for (const id of subscribed) {
        try { socket.emit(CHAT_EVENTS.UNSUBSCRIBE, { conversationId: id }); } catch (e) {}
      }
      subscribed.clear();
    };

    const trySubscribeAll = () => {
      const convos = useMessageStore.getState().conversations || [];
      for (const c of convos) {
        if (!c.conversationId) continue;
        if (subscribed.has(c.conversationId)) continue;
        try { socket.emit(CHAT_EVENTS.SUBSCRIBE, { conversationId: c.conversationId }); subscribed.add(c.conversationId); } catch (e) { console.warn('subscribe failed', e); }
      }
    };

    // initial attempt
    trySubscribeAll();
    // also listen for conversation updates to subscribe newly created ones
    socket.on(CHAT_EVENTS.CONVERSATION_UPDATED, (conversation: any) => {
      if (conversation?.conversationId && !subscribed.has(conversation.conversationId)) {
        try { socket.emit(CHAT_EVENTS.SUBSCRIBE, { conversationId: conversation.conversationId }); subscribed.add(conversation.conversationId); } catch (e) {}
      }
    });

    return () => {
      socket.off(CHAT_EVENTS.RECEIVE, handler);
      socket.off(CHAT_EVENTS.CONVERSATION_UPDATED as any, () => {});
      unsubConvos();
    };
  }, [authUser?._id, upsertMessage, incrementUnread, activeConversationId]);
}

export default useGlobalChatListener;
