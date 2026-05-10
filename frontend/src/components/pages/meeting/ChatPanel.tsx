import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { motion } from "motion/react";
import { MessageSquare, Send, X, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMeetingStore } from "@/stores/meetingStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  roomCode: string;
  onClose: () => void;
  sendMessage: (content: string) => void;
}

/**
 * Chat sidebar panel for in-meeting messaging.
 * Handles send/receive via useChatEvents hook, auto-scrolls on new messages,
 * and supports system message styling.
 */
export function ChatPanel({ roomCode, onClose, sendMessage }: ChatPanelProps) {
  const myUserId = useAuthStore((s) => s.user?._id);
  const messages = useMeetingStore((s) => s.messages);

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Track if user is near bottom using IntersectionObserver
  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isNearBottomRef.current = entry.isIntersecting;
      },
      { root: null, threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isNearBottomRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
    // Force scroll to bottom immediately after sending
    isNearBottomRef.current = true;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-80 flex flex-col bg-surface-container-low rounded-[2rem] shadow-sm overflow-hidden border border-outline-variant/10"
    >
      {/* Header */}
      <div className="p-6 bg-surface-container-high flex justify-between items-center border-b border-outline-variant/10">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-on-surface">Meeting Chat</h3>
          {messages.length > 0 && (
            <span className="text-[10px] font-bold text-on-surface-variant/50 bg-surface-container px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-on-surface-variant hover:text-primary transition-colors"
          aria-label="Close chat"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="h-[calc(100vh-24rem)]">
        <div className="p-4 h-full px-6 py-4 flex flex-col gap-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <MessageSquare
                size={24}
                className="text-on-surface-variant/30 mb-2"
              />
              <p className="text-xs text-on-surface-variant/40">
                No messages yet
              </p>
              <p className="text-[10px] text-on-surface-variant/30 mt-1">
                Send a message to start the conversation
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.type === "system") {
                return <SystemMessage key={msg.id} content={msg.content} />;
              }
              const isSelf = msg.senderId === myUserId;
              return (
                <ChatBubble
                  key={msg.id}
                  name={msg.senderName}
                  time={new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  message={msg.content}
                  isSelf={isSelf}
                />
              );
            })
          )}
          {/* Dummy element to track bottom */}
          <div ref={bottomRef} className="h-8 shrink-0" />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 bg-surface-container-low border-t border-outline-variant/10">
        <div className="relative flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className={cn(
              "flex-1 min-h-[44px] max-h-[120px] resize-none bg-surface-container-highest",
              "border-none rounded-2xl px-4 py-3 text-sm",
              "focus:ring-2 focus:ring-primary/20 focus:outline-none",
              "placeholder:text-on-surface-variant/40",
            )}
            placeholder="Send a message..."
            aria-label="Chat message input"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              "shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all",
              input.trim()
                ? "bg-primary text-white shadow-sm hover:bg-primary/90 active:scale-95"
                : "bg-surface-container-highest text-on-surface-variant/30 cursor-not-allowed",
            )}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}

/* ====================== Sub-components ====================== */

function ChatBubble({
  name,
  time,
  message,
  isSelf = false,
}: {
  name: string;
  time: string;
  message: string;
  isSelf?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        isSelf ? "items-end" : "items-start",
      )}
    >
      <div className="flex justify-between w-full items-end px-1">
        {!isSelf && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface">
            {name}
          </span>
        )}
        <span className="text-[10px] text-on-surface-variant/40 uppercase tracking-widest">
          {time}
        </span>
        {isSelf && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            You
          </span>
        )}
      </div>
      <div
        className={cn(
          "p-4 rounded-3xl text-sm shadow-sm border max-w-[240px] break-words whitespace-pre-wrap",
          isSelf
            ? "bg-primary text-white rounded-tr-none border-primary"
            : "bg-white inline text-on-surface rounded-tl-none border-outline-variant/10",
        )}
      >
        {message.trim()}
      </div>
    </div>
  );
}

function SystemMessage({ content }: { content: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container rounded-full">
        <Info size={12} className="text-on-surface-variant/50 shrink-0" />
        <span className="text-[11px] text-on-surface-variant/60 font-medium">
          {content}
        </span>
      </div>
    </div>
  );
}
