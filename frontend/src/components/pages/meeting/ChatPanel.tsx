import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { MessageSquare, Send, X, Info, Paperclip, Smile } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMeetingStore } from "@/stores/meetingStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { cn } from "@/lib/utils";
import { chatService } from "@/services/chatService";
import EmojiPicker from "@/components/ui/EmojiPicker";

interface ChatPanelProps {
  roomCode: string;
  onClose: () => void;
  sendMessage: (content: string | any) => void;
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    filename: string;
    size: number;
    mimeType: string;
    previewUrl: string;
    uploading: boolean;
    error?: string | null;
    file?: {
      url: string;
      filename: string;
      storedFilename?: string;
      mime_type?: string;
      size?: number;
    };
  } | null>(null);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      isNearBottomRef.current = entry.isIntersecting;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
    };
  }, [pendingAttachment?.previewUrl]);

  const clearPendingAttachment = () => {
    setPendingAttachment((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return null;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = () => {
    if (pendingAttachment) {
      if (pendingAttachment.uploading || pendingAttachment.error || !pendingAttachment.file) return;

      const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const payload = {
        type: "file",
        content: pendingAttachment.file.filename || pendingAttachment.file.url || '',
        attachment: pendingAttachment.file,
        clientId,
      };
        console.log('[CHAT PANEL] send payload (file)', payload);
        try { toast.info(`Sending file: ${payload.attachment?.filename || payload.content}`); } catch (e) {}
      sendMessage(payload);

      clearPendingAttachment();
      setInput("");
      isNearBottomRef.current = true;
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
      return;
    }

    if (!input.trim()) return;
      console.log('[CHAT PANEL] send payload (text)', input);
      try { toast.info(`Sending: ${input}`); } catch (e) {}
      sendMessage(input);
    setInput("");
    isNearBottomRef.current = true;
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
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
      className="w-80 flex flex-col bg-surface-container-low rounded-[2rem] shadow-sm overflow-hidden border border-outline-variant/10 z-[120] pointer-events-auto"
    >
      <div className="p-6 bg-surface-container-high flex justify-between items-center border-b border-outline-variant/10">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-on-surface">Meeting Chat</h3>
          {messages.length > 0 && (
            <span className="text-[10px] font-bold text-on-surface-variant/50 bg-surface-container px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors" aria-label="Close chat">
          <X size={20} />
        </button>
      </div>
      <ScrollArea className="h-[calc(100vh-24rem)]">
        <div className="p-4 h-full px-6 py-4 flex flex-col gap-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <MessageSquare size={24} className="text-on-surface-variant/30 mb-2" />
              <p className="text-xs text-on-surface-variant/40">No messages yet</p>
              <p className="text-[10px] text-on-surface-variant/30 mt-1">Send a message to start the conversation</p>
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.type === "system") return <SystemMessage key={msg.id} content={msg.content} />;
              const isSelf = msg.senderId === myUserId;
              return (
                <ChatBubble key={msg.id} name={msg.senderName} time={new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} message={msg.content} type={msg.type} attachment={(msg as any).attachment} isSelf={isSelf} />
              );
            })
          )}
          <div ref={bottomRef} className="h-8 shrink-0" />
        </div>
      </ScrollArea>

      <div className="p-4 bg-surface-container-low border-t border-outline-variant/10">
        <div className="flex items-end gap-2">
          <div className="flex items-center gap-2 mr-1">
            <label onClick={() => { try { fileInputRef.current?.click(); } catch (e) {} }} className="relative w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant/60 bg-surface-container-highest cursor-pointer overflow-hidden pointer-events-auto">
              <Paperclip size={16} />
              <input
                ref={fileInputRef}
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer pointer-events-auto"
                onClick={() => console.log('file input clicked')}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  console.log('ChatPanel: file input change', !!f, f?.name);
                  if (!f) return;
                  const previewUrl = URL.createObjectURL(f);
                  setPendingAttachment({
                    filename: f.name,
                    size: f.size,
                    mimeType: f.type || 'application/octet-stream',
                    previewUrl,
                    uploading: true,
                    error: null,
                  });

                  const form = new FormData(); form.append('file', f);
                  try {
                    const res = await chatService.uploadChatFile(form);
                    const file = res.file;
                    console.log('ChatPanel: upload result', res);
                    setPendingAttachment((current) => current ? ({
                      ...current,
                      uploading: false,
                      file,
                    }) : null);
                  } catch (err: any) {
                    console.error('Upload failed', err, err.response?.status, err.response?.data);
                    setPendingAttachment((current) => current ? ({
                      ...current,
                      uploading: false,
                      error: 'Upload failed',
                    }) : null);
                  } finally {
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }
                }}
              />
            </label>

            <button onClick={() => { console.debug('emoji button clicked'); setShowEmojiPicker((s) => !s); }} className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant/60 bg-surface-container-highest pointer-events-auto" aria-label="Emoji picker">
              <Smile size={16} />
            </button>
          </div>

          <div className="relative flex-1">
            {showEmojiPicker && (
              <div className="absolute bottom-14 left-0 z-50">
                <EmojiPicker onSelect={(emo) => { sendMessage({ type: 'emoji', content: emo, emoji: emo }); setShowEmojiPicker(false); }} />
              </div>
            )}

            {pendingAttachment && (
              <div className="mb-2 p-3 bg-surface-container rounded-lg border border-outline-variant/10 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-surface-container-highest overflow-hidden shrink-0 border border-outline-variant/10 flex items-center justify-center">
                    {pendingAttachment.mimeType.startsWith('image/') ? (
                      <img src={pendingAttachment.previewUrl} alt={pendingAttachment.filename} className="w-full h-full object-cover" />
                    ) : (
                      <Paperclip size={16} className="text-on-surface-variant/60" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-on-surface">{pendingAttachment.filename}</div>
                    <div className="text-xs text-on-surface-variant/60">
                      {pendingAttachment.size} bytes · {pendingAttachment.mimeType}
                    </div>
                    <div className="mt-1 text-xs">
                      {pendingAttachment.error ? (
                        <span className="text-error font-medium">{pendingAttachment.error}</span>
                      ) : pendingAttachment.uploading ? (
                        <span>Uploading… preview ready</span>
                      ) : (
                        <span>Ready to send</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button type="button" className="px-3 py-1.5 rounded-lg bg-surface-container-highest text-sm" onClick={clearPendingAttachment}>Cancel</button>
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm flex items-center gap-2",
                      pendingAttachment.uploading || Boolean(pendingAttachment.error) || !pendingAttachment.file
                        ? "bg-surface-container-highest text-on-surface-variant/40 cursor-not-allowed"
                        : "bg-primary text-white hover:bg-primary/90",
                    )}
                    onClick={handleSend}
                    disabled={pendingAttachment.uploading || Boolean(pendingAttachment.error) || !pendingAttachment.file}
                  >
                    <Send size={14} />
                    Send file
                  </button>
                </div>
              </div>
            )}

            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} rows={1} className={cn("flex-1 min-h-[44px] max-h-[120px] resize-none bg-surface-container-highest","border-none rounded-2xl px-4 py-3 text-sm","focus:ring-2 focus:ring-primary/20 focus:outline-none","placeholder:text-on-surface-variant/40")} placeholder="Send a message..." aria-label="Chat message input" />
          </div>

          <button onClick={handleSend} disabled={!input.trim()} className={cn("shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all", input.trim() ? "bg-primary text-white shadow-sm hover:bg-primary/90 active:scale-95" : "bg-surface-container-highest text-on-surface-variant/30 cursor-not-allowed")} aria-label="Send message">
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
  type,
  attachment,
  isSelf = false,
}: {
  name: string;
  time: string;
  message: string;
  type?: string;
  attachment?: any;
  isSelf?: boolean;
}) {
  const parsedAttachment = (() => {
    const candidate = attachment && typeof attachment === "object" ? attachment : null;
    if (candidate) return candidate;

    if (typeof message === "string") {
      try {
        const parsed = JSON.parse(message);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch {
        // not JSON, ignore
      }
    }

    return null;
  })();
  const looksLikeFileUrl = typeof message === "string" && /^https?:\/\//i.test(message);
  const fileUrl = parsedAttachment?.url || (looksLikeFileUrl ? message : null);
  const fileLabel = parsedAttachment?.filename || parsedAttachment?.name || parsedAttachment?.storedFilename || (looksLikeFileUrl ? message.split("/").pop() || message : message);
  const isImage = Boolean(
    parsedAttachment?.mime_type?.startsWith("image/") ||
      (fileUrl && /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(String(fileUrl)))
  );

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
          {(() => {
            if (type === 'emoji') {
              return <span className="text-2xl leading-none">{message}</span>;
            }

            if (type === 'file' || parsedAttachment || looksLikeFileUrl) {
              const caption = (typeof message === 'string' && message.trim() && message.trim() !== fileLabel) ? message.trim() : null;
              return (
                <div className="flex flex-col gap-2">
                  {isImage && fileUrl ? (
                    <a href={fileUrl} target="_blank" rel="noreferrer">
                      <img src={fileUrl} alt={fileLabel} className="max-h-44 rounded-2xl object-cover border border-white/20" />
                    </a>
                  ) : null}

                  {caption ? (
                    <div className="text-sm leading-snug break-words">{caption}</div>
                  ) : null}

                  {fileUrl ? (
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="underline break-all font-medium">
                      {fileLabel}
                    </a>
                  ) : (
                    <div className="font-medium break-all">{fileLabel || 'Attachment'}</div>
                  )}
                </div>
              );
            }

            if (typeof message === "string") {
              try {
                const parsed = JSON.parse(message);
                if (parsed && typeof parsed === "object" && parsed.url) {
                  return (
                    <a href={parsed.url} target="_blank" rel="noreferrer" className="underline break-all">
                      {parsed.filename || parsed.name || parsed.storedFilename || parsed.url}
                    </a>
                  );
                }
              } catch {
                // ignore and render as text
              }
              return message.trim();
            }
            return "";
          })()}
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
