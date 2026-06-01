import { useMemo, useState } from "react";
import SideBar from "@/components/layout/SideBar";
import { AddPersonDialog } from "@/components/chat/AddPersonDialog";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ConversationsSidebar } from "@/components/chat/ConversationsSidebar";
import { ConversationInfoDialog } from "@/components/chat/ConversationInfoDialog";
import { CallDialog } from "@/components/chat/CallDialog";
import { MessageEditHistoryDialog } from "@/components/chat/MessageEditHistoryDialog";
import { MessageForwardDialog } from "@/components/chat/MessageForwardDialog";
import { MessageReactionDialog } from "@/components/chat/MessageReactionDialog";
import { useConversations } from "@/hooks/chat/useConversations";
import { useMessages } from "@/hooks/chat/useMessages";
import { usePresence } from "@/hooks/chat/usePresence";
import { useWebRTCCall } from "@/hooks/chat/useWebRTCCall";
import { useSocket } from "@/hooks/useSocket";
import { useMessageStore } from "@/stores/messageStore";
import { useAuthStore } from "@/stores/useAuthStore";
import type { ChatMessage, MessageEditHistoryItem, MessageReactionUser, ReactionEmoji } from "@/services/chatService";

export function MessagesScreen() {
  useSocket();

  const authUser = useAuthStore((state) => state.user);
  const {
    conversations,
    activeConversationId,
    userSearchResults,
    isSearchingUsers,
    setActiveConversationId,
    searchUsers,
    startConversation,
    addPersonToConversation,
    renameConversation,
    renameConversationMember,
    removeConversationMember,
    deleteConversation,
  } = useConversations();
  const typingByConversationId = useMessageStore((state) => state.typingByConversationId);
  const presenceByUserId = useMessageStore((state) => state.presenceByUserId);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.conversationId === activeConversationId) || null,
    [activeConversationId, conversations]
  );

  const participantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const conversation of conversations) {
      for (const participant of conversation.participants) {
        ids.add(participant.id);
      }
      if (conversation.host?.id) {
        ids.add(conversation.host.id);
      }
    }
    if (authUser?._id) {
      ids.delete(authUser._id);
    }
    return [...ids];
  }, [authUser?._id, conversations]);

  usePresence(participantIds);

  const [showAddPersonDialog, setShowAddPersonDialog] = useState(false);
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  const [forwardMessageTarget, setForwardMessageTarget] = useState<ChatMessage | null>(null);
  const [editHistory, setEditHistory] = useState<MessageEditHistoryItem[]>([]);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [reactionUsers, setReactionUsers] = useState<MessageReactionUser[]>([]);
  const [reactionEmoji, setReactionEmoji] = useState<ReactionEmoji | undefined>(undefined);
  const [showReactionUsers, setShowReactionUsers] = useState(false);

  const {
    messages,
    hasMore,
    loadMore,
    composerState,
    sendMessage,
    setTypingState,
    startReply,
    startEdit,
    clearComposerState,
    deleteMessage,
    toggleReaction,
    forwardMessage,
    loadEditHistory,
    loadReactionUsers,
  } = useMessages(activeConversationId);
  const {
    activeCall,
    localStream,
    remoteParticipants,
    error,
    isMicEnabled,
    isCameraEnabled,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    dismissCall,
    toggleMicrophone,
    toggleCamera,
  } = useWebRTCCall(activeConversationId);

  return (
    <div className="flex min-h-screen bg-surface">
      <SideBar />

      <main className="ml-64 flex h-screen overflow-hidden w-[calc(100%-16rem)]">
        <ConversationsSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          userSearchResults={userSearchResults}
          isSearchingUsers={isSearchingUsers}
          presenceByUserId={presenceByUserId}
          onSelectConversation={setActiveConversationId}
          onSearchUsers={searchUsers}
          onStartConversation={startConversation}
        />
        <ChatWindow
          conversation={activeConversation}
          messages={messages}
          typing={activeConversationId ? typingByConversationId[activeConversationId] || null : null}
          currentUserId={authUser?._id || null}
          presenceByUserId={presenceByUserId}
          hasMore={hasMore}
          composerState={composerState}
          onLoadMore={loadMore}
          onSendMessage={sendMessage}
          onTypingChange={setTypingState}
          onCancelComposerState={clearComposerState}
          onReplyMessage={startReply}
          onEditMessage={startEdit}
          onDeleteMessage={deleteMessage}
          onForwardMessage={(message) => setForwardMessageTarget(message)}
          onToggleReaction={toggleReaction}
          onShowEditHistory={async (message) => {
            const edits = await loadEditHistory(message.messageId);
            setEditHistory(edits);
            setShowEditHistory(true);
          }}
          onShowReactions={async (message, emoji) => {
            const reactions = await loadReactionUsers(message.messageId, emoji);
            setReactionUsers(reactions);
            setReactionEmoji(emoji);
            setShowReactionUsers(true);
          }}
          onStartCall={(callType) => {
            const targetIds = activeConversation?.participants.map((participant) => participant.id) || [];
            if (targetIds.length > 0 && activeConversationId) {
              startCall(targetIds, callType);
            }
          }}
          onOpenAddPerson={() => setShowAddPersonDialog(true)}
          onOpenConversationInfo={() => setShowConversationInfo(true)}
        />
      </main>

      <AddPersonDialog
        open={showAddPersonDialog}
        onOpenChange={setShowAddPersonDialog}
        conversation={activeConversation}
        onAddPerson={async (payload) => {
          if (!activeConversationId) {
            return;
          }
          await addPersonToConversation(activeConversationId, payload);
        }}
      />

      <ConversationInfoDialog
        open={showConversationInfo}
        onOpenChange={setShowConversationInfo}
        conversation={activeConversation}
        onRenameConversation={async (title) => {
          if (!activeConversationId) {
            return;
          }
          await renameConversation(activeConversationId, title);
        }}
        onRenameMember={async (userId, nickname) => {
          if (!activeConversationId) {
            return;
          }
          await renameConversationMember(activeConversationId, userId, nickname);
        }}
        onRemoveMember={async (userId) => {
          if (!activeConversationId) {
            return;
          }
          await removeConversationMember(activeConversationId, userId);
        }}
        onDeleteConversation={async () => {
          if (!activeConversationId) {
            return;
          }
          await deleteConversation(activeConversationId);
        }}
      />

      <MessageForwardDialog
        open={Boolean(forwardMessageTarget)}
        onOpenChange={(open) => !open && setForwardMessageTarget(null)}
        message={forwardMessageTarget}
        conversations={conversations}
        currentConversationId={activeConversationId}
        onForward={async (targetConversationId) => {
          if (!forwardMessageTarget) {
            return;
          }
          await forwardMessage(forwardMessageTarget.messageId, targetConversationId);
          setForwardMessageTarget(null);
        }}
      />

      <MessageEditHistoryDialog
        open={showEditHistory}
        onOpenChange={setShowEditHistory}
        edits={editHistory}
      />

      <MessageReactionDialog
        open={showReactionUsers}
        onOpenChange={setShowReactionUsers}
        emoji={reactionEmoji}
        reactions={reactionUsers}
      />

      <CallDialog
        call={activeCall}
        localStream={localStream}
        remoteParticipants={remoteParticipants}
        error={error}
        isMicEnabled={isMicEnabled}
        isCameraEnabled={isCameraEnabled}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEnd={endCall}
        onClose={dismissCall}
        onToggleMicrophone={toggleMicrophone}
        onToggleCamera={toggleCamera}
      />
    </div>
  );
}
