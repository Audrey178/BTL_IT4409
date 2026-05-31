import { useEffect, useMemo, useRef } from "react";
import { Forward, Reply, SmilePlus, SquarePen, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatMessage, ReactionEmoji } from "@/services/chatService";
import { getMessageReceiptLabel } from "@/stores/messageStore";

interface MessageThreadProps {
  conversationId: string | null;
  messages: ChatMessage[];
  typing: { userId: string; userName: string } | null;
  currentUserId: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onReplyMessage: (message: ChatMessage) => void;
  onEditMessage: (message: ChatMessage) => void;
  onDeleteMessage: (message: ChatMessage, mode: "for_me" | "for_everyone") => void | Promise<void>;
  onForwardMessage: (message: ChatMessage) => void;
  onToggleReaction: (message: ChatMessage, emoji: ReactionEmoji) => void | Promise<void>;
  onShowEditHistory: (message: ChatMessage) => void;
  onShowReactions: (message: ChatMessage, emoji?: ReactionEmoji) => void;
}

const REACTIONS: Array<{ emoji: ReactionEmoji; label: string }> = [
  { emoji: "like", label: "👍" },
  { emoji: "love", label: "❤️" },
  { emoji: "haha", label: "😂" },
  { emoji: "wow", label: "😮" },
  { emoji: "sad", label: "😢" },
  { emoji: "angry", label: "😡" },
];

const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDay = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString([], { month: "long", day: "numeric" });

const toolbarVisibilityClass =
  "opacity-100 md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto transition-opacity duration-150";

const pillClass =
  "flex items-center gap-1 rounded-full border border-outline-variant/20 bg-surface-container-lowest/95 px-2 py-1 shadow-[0_10px_24px_rgba(88,66,59,0.12)] backdrop-blur";

export function MessageThread({
  conversationId,
  messages,
  typing,
  currentUserId,
  hasMore,
  onLoadMore,
  onReplyMessage,
  onEditMessage,
  onDeleteMessage,
  onForwardMessage,
  onToggleReaction,
  onShowEditHistory,
  onShowReactions,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typing?.userId]);

  const grouped = useMemo(() => {
    const rows: Array<{ kind: "day"; id: string; label: string } | { kind: "message"; message: ChatMessage }> = [];
    let currentDay = "";

    for (const message of messages) {
      const nextDay = formatDay(message.timestamp);
      if (nextDay !== currentDay) {
        currentDay = nextDay;
        rows.push({ kind: "day", id: `day-${currentDay}`, label: currentDay });
      }
      rows.push({ kind: "message", message });
    }

    return rows;
  }, [messages]);

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="p-8 space-y-6">
        {hasMore ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onLoadMore}
              className="text-xs uppercase tracking-[0.18em] text-on-surface-variant hover:text-primary"
            >
              Load older messages
            </button>
          </div>
        ) : null}

        {!conversationId ? (
          <div className="h-full min-h-80 flex items-center justify-center text-sm text-on-surface-variant">
            Select a conversation to view messages.
          </div>
        ) : null}

        {grouped.map((entry) => {
          if (entry.kind === "day") {
            return (
              <div key={entry.id} className="flex items-center gap-4">
                <div className="flex-1 h-px bg-outline-variant/30" />
                <span className="font-label-caps text-on-surface-variant opacity-60">
                  {entry.label}
                </span>
                <div className="flex-1 h-px bg-outline-variant/30" />
              </div>
            );
          }

          const message = entry.message;
          const isOutgoing = message.senderId === currentUserId;
          const receiptLabel = getMessageReceiptLabel(
            message.senderId,
            currentUserId,
            message.status,
            message.delivery
          );

          if (message.type === "system") {
            return (
              <div key={message.messageId} className="flex justify-center">
                <div className="px-4 py-2 rounded-full bg-surface-container-high text-xs text-on-surface-variant">
                  {message.content}
                </div>
              </div>
            );
          }

          return (
            <div
              key={message.messageId}
              className={cn(
                "group flex items-start gap-4 max-w-[80%]",
                isOutgoing ? "flex-row-reverse ml-auto" : "",
              )}
            >
              <Avatar className="w-9 h-9 rounded-full object-cover mt-1 after:hidden">
                <AvatarImage
                  src={message.senderAvatar || undefined}
                  alt={message.senderName}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover mt-1"
                />
                <AvatarFallback>{message.senderName.slice(0, 2)}</AvatarFallback>
              </Avatar>

              <div className={cn("relative min-w-0", isOutgoing ? "flex flex-col items-end" : "pb-11 md:pb-0")}>
                <span className="text-[11px] font-label-caps text-on-surface-variant mb-1 block px-2">
                  {message.senderName} • {formatTime(message.timestamp)}
                  {receiptLabel ? ` • ${receiptLabel}` : ""}
                </span>

                <div
                  className={cn(
                    "absolute z-10 flex items-center gap-2",
                    isOutgoing
                      ? "-left-3 top-8 -translate-x-full"
                      : "left-0 top-full mt-2 md:left-auto md:right-0 md:top-8 md:mt-0 md:translate-x-[calc(100%+12px)]",
                    toolbarVisibilityClass,
                  )}
                >
                  {!message.deletedForEveryoneAt ? (
                    <div className={pillClass}>
                      {REACTIONS.map((reaction) => (
                        <button
                          key={`${message.messageId}-toggle-${reaction.emoji}`}
                          type="button"
                          onClick={() => {
                            Promise.resolve(onToggleReaction(message, reaction.emoji)).catch((error) => {
                              console.error("Failed to toggle reaction", error);
                            });
                          }}
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-sm transition-colors",
                            message.myReactions?.includes(reaction.emoji)
                              ? "bg-primary/12 text-primary"
                              : "text-on-surface-variant hover:bg-surface-container-high",
                          )}
                        >
                          {reaction.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => onShowReactions(message)}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
                      >
                        <SmilePlus className="size-3.5" />
                      </button>
                    </div>
                  ) : null}

                  <div className={cn(pillClass, "px-1.5")}>
                    <button
                      type="button"
                      onClick={() => onReplyMessage(message)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
                    >
                      <Reply className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onForwardMessage(message)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
                    >
                      <Forward className="size-3.5" />
                    </button>
                    {isOutgoing && message.type === "text" && !message.deletedForEveryoneAt ? (
                      <button
                        type="button"
                        onClick={() => onEditMessage(message)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
                      >
                        <SquarePen className="size-3.5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        Promise.resolve(onDeleteMessage(message, "for_me")).catch((error) => {
                          console.error("Failed to delete message for me", error);
                        });
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    {isOutgoing && !message.deletedForEveryoneAt ? (
                      <button
                        type="button"
                        onClick={() => {
                          Promise.resolve(onDeleteMessage(message, "for_everyone")).catch((error) => {
                            console.error("Failed to delete message for everyone", error);
                          });
                        }}
                        className="rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-error hover:bg-surface-container-high"
                      >
                        All
                      </button>
                    ) : null}
                  </div>
                </div>

                <div
                  className={cn(
                    "text-on-surface p-4 rounded-3xl shadow-editorial",
                    isOutgoing
                      ? "message-gradient text-white rounded-tr-none"
                      : "bg-surface-container-low rounded-tl-none",
                  )}
                >
                  {message.replyTo ? (
                    <button
                      type="button"
                      onClick={() => onReplyMessage(message)}
                      className={cn(
                        "mb-3 block w-full rounded-2xl border px-3 py-2 text-left text-xs",
                        isOutgoing
                          ? "border-white/20 bg-white/10 text-white/85"
                          : "border-outline-variant/20 bg-surface-container-high text-on-surface-variant",
                      )}
                    >
                      <span className="block font-semibold">{message.replyTo.senderName}</span>
                      <span className="block truncate">{message.replyTo.content}</span>
                    </button>
                  ) : null}
                  {message.forwardedFrom ? (
                    <p className={cn("mb-2 text-[11px] uppercase tracking-[0.14em]", isOutgoing ? "text-white/70" : "text-on-surface-variant")}>
                      Forwarded
                    </p>
                  ) : null}
                  <p className="text-body-base whitespace-pre-wrap break-words">{message.content}</p>
                  {message.isEdited ? (
                    <button
                      type="button"
                      onClick={() => onShowEditHistory(message)}
                      className={cn("mt-2 text-[11px]", isOutgoing ? "text-white/70" : "text-on-surface-variant")}
                    >
                      Edited
                    </button>
                  ) : null}
                </div>

                <div className={cn("mt-2 flex flex-wrap items-center gap-2 px-2", isOutgoing ? "justify-end" : "")}>
                  {!message.deletedForEveryoneAt ? message.reactionCounts.map((reaction) => (
                    <button
                      key={`${message.messageId}-${reaction.emoji}`}
                      type="button"
                      onClick={() => onShowReactions(message, reaction.emoji)}
                      className="rounded-full border border-outline-variant/20 bg-surface-container-high px-2.5 py-1 text-xs text-on-surface"
                    >
                      {REACTIONS.find((entry) => entry.emoji === reaction.emoji)?.label || reaction.emoji} {reaction.count}
                    </button>
                  )) : null}
                </div>
              </div>
            </div>
          );
        })}

        {typing ? (
          <div className="flex items-center gap-2 px-2 opacity-60">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce" />
            </div>
            <span className="text-[10px] font-label-caps text-on-surface-variant">
              {typing.userName} is typing...
            </span>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
