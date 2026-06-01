import type { ConversationItem, ChatMessage } from "@/services/chatService";
import type { ComposerState } from "@/hooks/chat/useMessages";
import type { PresenceEntry } from "@/stores/messageStore";
import { ChatHeader } from "./ChatHeader";
import { ChatTabs } from "./ChatTabs";
import { MessageInput } from "./MessageInput";
import { MessageThread } from "./MessageThread";

interface ChatWindowProps {
  conversation: ConversationItem | null;
  messages: ChatMessage[];
  typing: { userId: string; userName: string } | null;
  currentUserId: string | null;
  presenceByUserId: Record<string, PresenceEntry>;
  hasMore: boolean;
  composerState: ComposerState;
  onLoadMore: () => void;
  onSendMessage: (content: string | { type: import("@/services/chatService").MessageType; content?: string; file?: any; stickerId?: string; emoji?: string }) => void | Promise<void>;
  onTypingChange: (typing: boolean) => void;
  onCancelComposerState: () => void;
  onReplyMessage: (message: ChatMessage) => void;
  onEditMessage: (message: ChatMessage) => void;
  onDeleteMessage: (message: ChatMessage, mode: "for_me" | "for_everyone") => void | Promise<void>;
  onForwardMessage: (message: ChatMessage) => void;
  onToggleReaction: (message: ChatMessage, emoji: "like" | "love" | "haha" | "wow" | "sad" | "angry") => void | Promise<void>;
  onShowEditHistory: (message: ChatMessage) => void;
  onShowReactions: (message: ChatMessage, emoji?: "like" | "love" | "haha" | "wow" | "sad" | "angry") => void;
  onStartCall: (callType: "audio" | "video") => void;
  onOpenAddPerson: () => void;
  onOpenConversationInfo: () => void;
}

export function ChatWindow({
  conversation,
  messages,
  typing,
  currentUserId,
  presenceByUserId,
  hasMore,
  composerState,
  onLoadMore,
  onSendMessage,
  onTypingChange,
  onCancelComposerState,
  onReplyMessage,
  onEditMessage,
  onDeleteMessage,
  onForwardMessage,
  onToggleReaction,
  onShowEditHistory,
  onShowReactions,
  onStartCall,
  onOpenAddPerson,
  onOpenConversationInfo,
}: ChatWindowProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-lowest">
      <ChatHeader
        conversation={conversation}
        currentUserId={currentUserId}
        presenceByUserId={presenceByUserId}
        onStartCall={onStartCall}
        onOpenAddPerson={onOpenAddPerson}
        onOpenConversationInfo={onOpenConversationInfo}
      />
      <ChatTabs />
      <MessageThread
        conversationId={conversation?.conversationId || null}
        messages={messages}
        typing={typing}
        currentUserId={currentUserId}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        onReplyMessage={onReplyMessage}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
        onForwardMessage={onForwardMessage}
        onToggleReaction={onToggleReaction}
        onShowEditHistory={onShowEditHistory}
        onShowReactions={onShowReactions}
      />
      <MessageInput
        disabled={!conversation}
        composerState={composerState}
        onSend={onSendMessage}
        onTypingChange={onTypingChange}
        onCancelComposerState={onCancelComposerState}
      />
    </section>
  );
}
