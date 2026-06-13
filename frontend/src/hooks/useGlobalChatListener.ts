import { useEffect } from "react";
import { getSocket } from "@/socket/socket";
import { CHAT_EVENTS } from "@/socket/events";
import { useAuthStore } from "@/stores/useAuthStore";
import { useMessageStore } from "@/stores/messageStore";
import { toast } from "sonner";

export function useGlobalChatListener() {
  const authUser = useAuthStore((s) => s.user);
  const upsertMessage = useMessageStore((s) => s.upsertMessage);
  const incrementUnread = useMessageStore((s) => s.incrementUnread);
  const activeConversationId = useMessageStore((s) => s.activeConversationId);
  const updateMessageReceipt = useMessageStore((s) => s.updateMessageReceipt);
  const setTyping = useMessageStore((s) => s.setTyping);
  const markMessageDeleted = useMessageStore((s) => s.markMessageDeleted);
  const removeConversation = useMessageStore((s) => s.removeConversation);

  useEffect(() => {
    const socket = getSocket();
    const subscribed = new Set<string>();

    const handleReceive = (data: any) => {
      try {
        const conversationId =
          data.conversationId || data.conversation_id || data.roomId || null;
        if (!conversationId) return;

        const message = {
          _id: data._id || data.messageId || data.id,
          messageId: data.messageId || data._id || data.id,
          conversationId,
          senderId: data.senderId || data.sender_id,
          senderName: data.senderName || data.sender_name,
          senderAvatar: data.senderAvatar || data.sender_avatar || null,
          content: data.content,
          type: data.type || "text",
          timestamp: data.timestamp || new Date().toISOString(),
          attachment: data.attachment || null,
          clientId: data.clientId || data.client_id || null,
          version: data.version || 1,
          status: data.status || "sent",
          delivery: data.delivery || [],
          replyTo: data.replyTo || null,
          reactionCounts: data.reactionCounts || [],
          myReactions: data.myReactions || [],
        } as any;

        upsertMessage(conversationId, message);

        if (
          message.senderId &&
          authUser?._id &&
          message.senderId !== authUser._id
        ) {
          if (conversationId !== activeConversationId) {
            const preview =
              message.type === "file"
                ? message.attachment?.filename ||
                  message.content ||
                  "Attachment"
                : message.content;
            toast.info(`Tin nhắn mới từ ${message.senderName}`, {
              description: preview,
            });
            incrementUnread(conversationId);
          } else {
            socket.emit(CHAT_EVENTS.RECEIPT, {
              conversationId,
              status: "read",
              messageIds: [message.messageId],
            });
          }
        }
      } catch (e) {
        console.error("global listener error", e);
      }
    };

    const handleDelivered = (payload: {
      conversationId?: string;
      messageIds: string[];
    }) => {
      const conversationId = payload.conversationId;
      if (!conversationId) return;
      for (const messageId of payload.messageIds) {
        const current = (
          useMessageStore.getState().messagesByConversationId[conversationId] ||
          []
        ).find((m) => m.messageId === messageId);
        if (current) {
          updateMessageReceipt(conversationId, {
            ...current,
            status: "delivered",
          });
        }
      }
    };

    const handleRead = (payload: { conversationId?: string; message: any }) => {
      const conversationId =
        payload.conversationId || payload.message?.conversationId;
      if (!conversationId || !payload.message) return;
      updateMessageReceipt(conversationId, payload.message);
    };

    const handleReceiptUpdated = (payload: { message?: any }) => {
      if (!payload.message || !payload.message.conversationId) return;
      updateMessageReceipt(payload.message.conversationId, payload.message);
    };

    const handleTyping = (payload: {
      conversationId?: string;
      userId: string;
      userName: string;
    }) => {
      const conversationId = payload.conversationId;
      if (conversationId && payload.userId !== authUser?._id) {
        setTyping(conversationId, {
          userId: payload.userId,
          userName: payload.userName,
        });
      }
    };

    const handleTypingStop = (payload: {
      conversationId?: string;
      userId: string;
    }) => {
      const conversationId = payload.conversationId;
      if (conversationId && payload.userId !== authUser?._id) {
        setTyping(conversationId, null);
      }
    };

    const handleDeleted = (payload: {
      conversationId?: string;
      messageId?: string;
      deletedConversationId?: string;
    }) => {
      if (payload.deletedConversationId) {
        removeConversation(payload.deletedConversationId);
        return;
      }
      if (payload.conversationId && payload.messageId) {
        markMessageDeleted(payload.conversationId, payload.messageId);
      }
    };

    const handleMessageUpdated = (payload: { message?: any }) => {
      if (!payload.message || !payload.message.conversationId) return;
      upsertMessage(payload.message.conversationId, payload.message);
    };

    const handleMessageHidden = (payload: {
      conversationId?: string;
      messageId?: string;
    }) => {
      if (payload.conversationId && payload.messageId) {
        markMessageDeleted(payload.conversationId, payload.messageId);
      }
    };

    socket.on(CHAT_EVENTS.RECEIVE, handleReceive);
    socket.on(CHAT_EVENTS.DELIVERED, handleDelivered);
    socket.on(CHAT_EVENTS.READ, handleRead);
    socket.on(CHAT_EVENTS.RECEIPT_UPDATED, handleReceiptUpdated);
    socket.on(CHAT_EVENTS.TYPING, handleTyping);
    socket.on(CHAT_EVENTS.TYPING_STOP, handleTypingStop);
    socket.on(CHAT_EVENTS.DELETED, handleDeleted);
    socket.on(CHAT_EVENTS.MESSAGE_UPDATED, handleMessageUpdated);
    socket.on(CHAT_EVENTS.MESSAGE_DELETED, handleMessageUpdated);
    socket.on(CHAT_EVENTS.MESSAGE_HIDDEN, handleMessageHidden);
    socket.on(CHAT_EVENTS.REACTION_UPDATED, handleMessageUpdated);

    const unsubConvos = () => {
      for (const id of subscribed) {
        try {
          socket.emit(CHAT_EVENTS.UNSUBSCRIBE, { conversationId: id });
        } catch (e) {}
      }
      subscribed.clear();
    };

    const trySubscribeAll = () => {
      const convos = useMessageStore.getState().conversations || [];
      for (const c of convos) {
        if (!c.conversationId) continue;
        if (subscribed.has(c.conversationId)) continue;
        try {
          socket.emit(CHAT_EVENTS.SUBSCRIBE, {
            conversationId: c.conversationId,
          });
          subscribed.add(c.conversationId);
        } catch (e) {
          console.warn("subscribe failed", e);
        }
      }
    };

    trySubscribeAll();

    socket.on(CHAT_EVENTS.CONVERSATION_UPDATED, (conversation: any) => {
      if (
        conversation?.conversationId &&
        !subscribed.has(conversation.conversationId)
      ) {
        try {
          socket.emit(CHAT_EVENTS.SUBSCRIBE, {
            conversationId: conversation.conversationId,
          });
          subscribed.add(conversation.conversationId);
        } catch (e) {}
      }
    });

    return () => {
      socket.off(CHAT_EVENTS.RECEIVE, handleReceive);
      socket.off(CHAT_EVENTS.DELIVERED, handleDelivered);
      socket.off(CHAT_EVENTS.READ, handleRead);
      socket.off(CHAT_EVENTS.RECEIPT_UPDATED, handleReceiptUpdated);
      socket.off(CHAT_EVENTS.TYPING, handleTyping);
      socket.off(CHAT_EVENTS.TYPING_STOP, handleTypingStop);
      socket.off(CHAT_EVENTS.DELETED, handleDeleted);
      socket.off(CHAT_EVENTS.MESSAGE_UPDATED, handleMessageUpdated);
      socket.off(CHAT_EVENTS.MESSAGE_DELETED, handleMessageUpdated);
      socket.off(CHAT_EVENTS.MESSAGE_HIDDEN, handleMessageHidden);
      socket.off(CHAT_EVENTS.REACTION_UPDATED, handleMessageUpdated);

      socket.off(CHAT_EVENTS.CONVERSATION_UPDATED as any, () => {});
      unsubConvos();
    };
  }, [authUser?._id, upsertMessage, incrementUnread, activeConversationId]);
}

export default useGlobalChatListener;
