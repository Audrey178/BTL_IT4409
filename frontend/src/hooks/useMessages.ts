import { useEffect, useRef, useState } from "react";
import {
  chatService,
  type ChatMessage,
  type MessageEditHistoryItem,
  type MessageReactionUser,
  type ReactionEmoji,
} from "@/services/chatService";
import { getSocket } from "@/socket/socket";
import { CHAT_EVENTS } from "@/socket/events";
import { useAuthStore } from "@/stores/useAuthStore";
import { useMessageStore } from "@/stores/messageStore";

const buildClientId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const EMPTY_MESSAGES: ChatMessage[] = [];

export interface ComposerState {
  mode: "default" | "reply" | "edit";
  message: ChatMessage | null;
}

const withMyReaction = (message: ChatMessage, emoji: ReactionEmoji, active: boolean): ChatMessage => {
  const current = new Set(message.myReactions || []);
  if (active) {
    current.add(emoji);
  } else {
    current.delete(emoji);
  }

  return {
    ...message,
    myReactions: [...current],
  };
};

export function useMessages(conversationId: string | null) {
  const authUser = useAuthStore((state) => state.user);
  const messages = useMessageStore((state) => {
    if (!conversationId) {
      return EMPTY_MESSAGES;
    }
    return state.messagesByConversationId[conversationId] || EMPTY_MESSAGES;
  });
  const setMessages = useMessageStore((state) => state.setMessages);
  const prependMessages = useMessageStore((state) => state.prependMessages);
  const upsertMessage = useMessageStore((state) => state.upsertMessage);
  const markMessageDeleted = useMessageStore((state) => state.markMessageDeleted);
  const updateMessageReceipt = useMessageStore((state) => state.updateMessageReceipt);
  const removeConversation = useMessageStore((state) => state.removeConversation);
  const clearUnread = useMessageStore((state) => state.clearUnread);
  const incrementUnread = useMessageStore((state) => state.incrementUnread);
  const setTyping = useMessageStore((state) => state.setTyping);
  const activeConversationId = useMessageStore((state) => state.activeConversationId);

  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [composerState, setComposerState] = useState<ComposerState>({ mode: "default", message: null });
  const pageRef = useRef(1);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const socket = getSocket();
    const load = async () => {
      setIsLoading(true);
      try {
        const result = await chatService.getConversationMessages(conversationId, { page: 1, limit: 50 });
        pageRef.current = 1;
        setMessages(conversationId, result.messages);
        setHasMore(result.pagination.page < result.pagination.pages);
        clearUnread(conversationId);
        socket.emit(CHAT_EVENTS.SUBSCRIBE, { conversationId });
        if (result.messages.length > 0) {
          socket.emit(CHAT_EVENTS.RECEIPT, {
            conversationId,
            status: "read",
            messageIds: result.messages
              .filter((message) => message.senderId && message.senderId !== authUser?._id)
              .map((message) => message.messageId),
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    load().catch((error) => {
      console.error("Failed to load messages", error);
    });

    return () => {
      socket.emit(CHAT_EVENTS.UNSUBSCRIBE, { conversationId });
      setTyping(conversationId, null);
      setComposerState({ mode: "default", message: null });
    };
  }, [authUser?._id, clearUnread, conversationId, setMessages, setTyping]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const socket = getSocket();

    const handleReceive = (message: ChatMessage) => {
      if (message.conversationId !== conversationId) {
        return;
      }
      if (message.messageId && conversationId !== activeConversationId) {
        incrementUnread(conversationId);
      }
      upsertMessage(conversationId, message);
      if (message.senderId && message.senderId !== authUser?._id) {
        socket.emit(CHAT_EVENTS.RECEIPT, {
          conversationId,
          status: "read",
          messageIds: [message.messageId],
        });
      }
    };

    const handleDelivered = (payload: { conversationId?: string; messageIds: string[] }) => {
      if (payload.conversationId !== conversationId) {
        return;
      }
      for (const messageId of payload.messageIds) {
        const current = (useMessageStore.getState().messagesByConversationId[conversationId] || []).find(
          (message) => message.messageId === messageId
        );
        if (current) {
          updateMessageReceipt(conversationId, { ...current, status: "delivered" });
        }
      }
    };

    const handleRead = (payload: { conversationId?: string; message: ChatMessage }) => {
      if (payload.conversationId !== conversationId) {
        return;
      }
      updateMessageReceipt(conversationId, payload.message);
    };

    const handleReceiptUpdated = (payload: { message?: ChatMessage }) => {
      if (!payload.message || payload.message.conversationId !== conversationId) {
        return;
      }
      updateMessageReceipt(conversationId, payload.message);
    };

    const handleTyping = (payload: { conversationId?: string; userId: string; userName: string }) => {
      if (payload.conversationId === conversationId && payload.userId !== authUser?._id) {
        setTyping(conversationId, { userId: payload.userId, userName: payload.userName });
      }
    };

    const handleTypingStop = (payload: { conversationId?: string; userId: string }) => {
      if (payload.conversationId === conversationId && payload.userId !== authUser?._id) {
        setTyping(conversationId, null);
      }
    };

    const handleDeleted = (payload: { conversationId?: string; messageId?: string; deletedConversationId?: string }) => {
      if (payload.deletedConversationId && payload.deletedConversationId === conversationId) {
        removeConversation(conversationId);
        return;
      }
      if (payload.conversationId === conversationId && payload.messageId) {
        markMessageDeleted(conversationId, payload.messageId);
      }
    };

    const handleMessageUpdated = (payload: { message?: ChatMessage }) => {
      if (!payload.message || payload.message.conversationId !== conversationId) {
        return;
      }
      upsertMessage(conversationId, payload.message);
    };

    const handleMessageDeleted = (payload: { message?: ChatMessage }) => {
      if (!payload.message || payload.message.conversationId !== conversationId) {
        return;
      }
      upsertMessage(conversationId, payload.message);
    };

    const handleMessageHidden = (payload: { messageId?: string }) => {
      if (payload.messageId) {
        markMessageDeleted(conversationId, payload.messageId);
      }
    };

    const handleReactionUpdated = (payload: { message?: ChatMessage }) => {
      if (!payload.message || payload.message.conversationId !== conversationId) {
        return;
      }
      upsertMessage(conversationId, payload.message);
    };

    socket.on(CHAT_EVENTS.RECEIVE, handleReceive);
    socket.on(CHAT_EVENTS.DELIVERED, handleDelivered);
    socket.on(CHAT_EVENTS.READ, handleRead);
    socket.on(CHAT_EVENTS.RECEIPT_UPDATED, handleReceiptUpdated);
    socket.on(CHAT_EVENTS.TYPING, handleTyping);
    socket.on(CHAT_EVENTS.TYPING_STOP, handleTypingStop);
    socket.on(CHAT_EVENTS.DELETED, handleDeleted);
    socket.on(CHAT_EVENTS.MESSAGE_UPDATED, handleMessageUpdated);
    socket.on(CHAT_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
    socket.on(CHAT_EVENTS.MESSAGE_HIDDEN, handleMessageHidden);
    socket.on(CHAT_EVENTS.REACTION_UPDATED, handleReactionUpdated);

    return () => {
      socket.off(CHAT_EVENTS.RECEIVE, handleReceive);
      socket.off(CHAT_EVENTS.DELIVERED, handleDelivered);
      socket.off(CHAT_EVENTS.READ, handleRead);
      socket.off(CHAT_EVENTS.RECEIPT_UPDATED, handleReceiptUpdated);
      socket.off(CHAT_EVENTS.TYPING, handleTyping);
      socket.off(CHAT_EVENTS.TYPING_STOP, handleTypingStop);
      socket.off(CHAT_EVENTS.DELETED, handleDeleted);
      socket.off(CHAT_EVENTS.MESSAGE_UPDATED, handleMessageUpdated);
      socket.off(CHAT_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
      socket.off(CHAT_EVENTS.MESSAGE_HIDDEN, handleMessageHidden);
      socket.off(CHAT_EVENTS.REACTION_UPDATED, handleReactionUpdated);
    };
  }, [activeConversationId, authUser?._id, conversationId, incrementUnread, markMessageDeleted, removeConversation, setTyping, updateMessageReceipt, upsertMessage]);

  const sendMessage = async (content: string) => {
    if (!conversationId || !authUser?._id || !content.trim()) {
      return;
    }

    if (composerState.mode === "edit" && composerState.message) {
      const current = composerState.message;
      const previousContent = current.content;
      const optimistic: ChatMessage = {
        ...current,
        content: content.trim(),
        version: current.version + 1,
        isEdited: true,
        editCount: current.editCount + 1,
        editedAt: new Date().toISOString(),
      };

      upsertMessage(conversationId, optimistic);
      try {
        const result = await chatService.editMessage(current.messageId, {
          content: content.trim(),
          expectedVersion: current.version,
          clientMutationId: buildClientId(),
        });
        upsertMessage(conversationId, result.message);
        setComposerState({ mode: "default", message: null });
      } catch (error) {
        upsertMessage(conversationId, { ...current, content: previousContent });
        throw error;
      }
      return;
    }

    const clientId = buildClientId();
    const optimistic: ChatMessage = {
      _id: clientId,
      messageId: clientId,
      conversationId,
      sender_id: authUser._id,
      sender_name: authUser.full_name,
      sender_avatar: authUser.avatar || null,
      senderId: authUser._id,
      senderName: authUser.full_name,
      senderAvatar: authUser.avatar || null,
      type: "text",
      content: content.trim(),
      timestamp: new Date().toISOString(),
      status: "sent",
      clientId,
      version: 1,
      delivery: [],
      ownReceipt: null,
      editCount: 0,
      isEdited: false,
      editedAt: null,
      editedBy: null,
      deletedForEveryoneAt: null,
      deletedBy: null,
      deleteReason: null,
      replyTo:
        composerState.mode === "reply" && composerState.message
          ? {
              messageId: composerState.message.messageId,
              senderId: composerState.message.senderId,
              senderName: composerState.message.senderName,
              content: composerState.message.content,
              type: composerState.message.type,
              timestamp: composerState.message.timestamp,
            }
          : null,
      forwardedFrom: null,
      reactionCounts: [],
      myReactions: [],
      systemEvent: null,
    };

    upsertMessage(conversationId, optimistic);
    getSocket().emit(CHAT_EVENTS.SEND, {
      conversationId,
      content: content.trim(),
      type: "text",
      clientId,
      replyToMessageId: composerState.mode === "reply" ? composerState.message?.messageId || null : null,
    });
    setComposerState({ mode: "default", message: null });
  };

  const deleteMessage = async (message: ChatMessage, mode: "for_me" | "for_everyone") => {
    if (!conversationId) {
      return;
    }

    if (mode === "for_me") {
      markMessageDeleted(conversationId, message.messageId);
      try {
        await chatService.deleteMessage(message.messageId, {
          mode,
          clientMutationId: buildClientId(),
        });
      } catch (error) {
        upsertMessage(conversationId, message);
        throw error;
      }
      return;
    }

    const optimistic: ChatMessage = {
      ...message,
      content: "This message was deleted",
      deletedForEveryoneAt: new Date().toISOString(),
      deletedBy: authUser?._id || null,
      version: message.version + 1,
    };
    upsertMessage(conversationId, optimistic);
    const result = await chatService.deleteMessage(message.messageId, {
      mode,
      expectedVersion: message.version,
      clientMutationId: buildClientId(),
    });
    if (result.message) {
      upsertMessage(conversationId, result.message);
    }
  };

  const toggleReaction = async (message: ChatMessage, emoji: ReactionEmoji) => {
    if (!conversationId) {
      return;
    }

    const active = (message.myReactions || []).includes(emoji);
    const result = active
      ? await chatService.removeReaction(message.messageId, emoji, buildClientId())
      : await chatService.addReaction(message.messageId, emoji, buildClientId());

    upsertMessage(conversationId, withMyReaction(result.message, emoji, !active));
  };

  const forwardMessage = async (messageId: string, targetConversationId: string) => {
    await chatService.forwardMessage(messageId, {
      targetType: "conversation",
      targetId: targetConversationId,
      clientId: buildClientId(),
      clientMutationId: buildClientId(),
    });
  };

  const loadEditHistory = async (messageId: string): Promise<MessageEditHistoryItem[]> => {
    const result = await chatService.getMessageEdits(messageId);
    return result.edits;
  };

  const loadReactionUsers = async (messageId: string, emoji?: ReactionEmoji): Promise<MessageReactionUser[]> => {
    const result = await chatService.getMessageReactions(messageId, { emoji });
    return result.reactions;
  };

  const loadMore = async () => {
    if (!conversationId || isLoading || !hasMore) {
      return;
    }
    setIsLoading(true);
    try {
      const nextPage = pageRef.current + 1;
      const result = await chatService.getConversationMessages(conversationId, { page: nextPage, limit: 50 });
      pageRef.current = nextPage;
      prependMessages(conversationId, result.messages);
      setHasMore(result.pagination.page < result.pagination.pages);
    } finally {
      setIsLoading(false);
    }
  };

  const setTypingState = (typing: boolean) => {
    if (!conversationId || !authUser?.full_name) {
      return;
    }
    getSocket().emit(typing ? CHAT_EVENTS.TYPING : CHAT_EVENTS.TYPING_STOP, {
      conversationId,
      userName: authUser.full_name,
    });
  };

  return {
    messages,
    isLoading,
    hasMore,
    composerState,
    sendMessage,
    loadMore,
    setTypingState,
    startReply: (message: ChatMessage) => setComposerState({ mode: "reply", message }),
    startEdit: (message: ChatMessage) => setComposerState({ mode: "edit", message }),
    clearComposerState: () => setComposerState({ mode: "default", message: null }),
    deleteMessage,
    toggleReaction,
    forwardMessage,
    loadEditHistory,
    loadReactionUsers,
  };
}
