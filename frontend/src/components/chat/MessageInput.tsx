import { useEffect, useState, useRef } from "react";
import { Paperclip, Reply, Send, Smile, SquarePen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ComposerState } from "@/hooks/useMessages";

import { chatService, type MessageType } from "@/services/chatService";
import EmojiPicker from "@/components/ui/EmojiPicker";

interface MessageInputProps {
  disabled?: boolean;
  composerState: ComposerState;
  onSend: (content: string | { type: MessageType; content?: string; file?: any; stickerId?: string; emoji?: string }) => void | Promise<void>;
  onTypingChange: (typing: boolean) => void;
  onCancelComposerState: () => void;
}

export function MessageInput({
  disabled = false,
  composerState,
  onSend,
  onTypingChange,
  onCancelComposerState,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    filename: string;
    size: number;
    mimeType: string;
    previewUrl: string;
    uploading: boolean;
    error?: string | null;
    rawFile?: File | Blob;
    file?: {
      url: string;
      filename: string;
      storedFilename?: string;
      mime_type?: string;
      size?: number;
    };
    clientId?: string;
  } | null>(null);

  useEffect(() => {
    if (composerState.mode === "edit") {
      setValue(composerState.message?.content || "");
    }
  }, [composerState]);

  useEffect(() => {
    if (!value.trim()) {
      onTypingChange(false);
      return;
    }

    onTypingChange(true);
    const timer = window.setTimeout(() => onTypingChange(false), 1200);
    return () => window.clearTimeout(timer);
  }, [onTypingChange, value]);

  const handleSend = async () => {
    // If there's a pending attachment, upload it and send as file message
    if (pendingAttachment && !disabled) {
      const clientId = pendingAttachment.clientId || `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      setPendingAttachment((p) => (p ? { ...p, uploading: true, clientId } : p));

      try {
        const form = new FormData();
        // @ts-ignore
        form.append('file', (pendingAttachment as any).rawFile || (pendingAttachment as any).fileBlob);
        // If we stored the actual File object, attach it; else try to attach via stored file in pendingAttachment.file
        if ((pendingAttachment as any).rawFile === undefined && (pendingAttachment as any).file) {
          // nothing to do, uploadChatFile expects a File in formdata; best-effort: assume pendingAttachment.file has storedFilename/url already
        }
        const res = await chatService.uploadChatFile(form);
        await onSend({ type: 'file', file: res.file, clientId } as any);
      } catch (err: any) {
        console.error('Upload/send failed', err);
        setPendingAttachment((current) => current ? ({ ...current, uploading: false, error: 'Upload failed' }) : null);
      } finally {
        setPendingAttachment(null);
      }

      return;
    }

    if (!value.trim() || disabled) {
      return;
    }

    const nextValue = value.trim();
    setValue("");
    onTypingChange(false);
    await onSend(nextValue);
  };

  return (
    <footer className="p-6 bg-surface-lowest">
      <div className="max-w-4xl mx-auto">
        {composerState.mode !== "default" && composerState.message ? (
            <div className="mb-3 rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-on-surface-variant">
                {composerState.mode === "reply" ? <Reply className="size-3.5" /> : <SquarePen className="size-3.5" />}
                {composerState.mode === "reply" ? "Replying to" : "Editing"}
                <span className="truncate text-on-surface">{composerState.message.senderName}</span>
              </div>
              <p className="mt-1 truncate text-sm text-on-surface-variant">
                {composerState.message.content}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onCancelComposerState()}
              className="p-1 rounded hover:bg-surface-container-highest"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        <div className="flex gap-3 bg-surface-container-low p-2 rounded-3xl border border-outline-variant/20 shadow-editorial focus-within:ring-2 focus-within:ring-primary/10 transition-all items-center">
        <div className="flex-1 flex items-center gap-2 pl-2">
          <div className="relative">
          <button
            type="button"
            disabled={disabled}
            className="p-2 rounded-lg hover:bg-surface-container-highest text-on-surface-variant flex-shrink-0 disabled:opacity-40"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="text-xl size-5" />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const previewUrl = URL.createObjectURL(f);
                setPendingAttachment({
                  filename: f.name,
                  size: f.size,
                  mimeType: f.type || 'application/octet-stream',
                  previewUrl,
                  uploading: false,
                  error: null,
                  caption: '',
                  // store the raw File so we can upload on Send
                  // @ts-ignore
                  rawFile: f,
                } as any);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
          </button>
          <button
            type="button"
            disabled={disabled}
            className="p-2 rounded-lg hover:bg-surface-container-highest text-on-surface-variant flex-shrink-0 disabled:opacity-40"
            onClick={() => setShowEmojiPicker((s) => !s)}
          >
            <Smile className="text-xl size-5" />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-12 left-0 z-50">
              <EmojiPicker onSelect={async (emo) => { await onSend({ type: 'emoji', emoji: emo, content: emo }); setShowEmojiPicker(false); }} />
            </div>
          )}
          </div>
          {pendingAttachment ? (
            <div className="w-full mb-2 flex items-center gap-3 bg-surface-container-high rounded-lg p-2 border border-outline-variant">
              <div className="w-28 h-16 rounded overflow-hidden bg-gray-50 flex-shrink-0">
                {pendingAttachment.mimeType?.startsWith?.('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pendingAttachment.previewUrl} alt={pendingAttachment.filename} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-on-surface-variant p-2">{pendingAttachment.filename}</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">{pendingAttachment.filename}</div>
                <div className="text-xs text-on-surface-variant">{(pendingAttachment.size / 1024).toFixed(1)} KB</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPendingAttachment(null)} className="rounded px-2 py-1 text-sm text-on-surface-variant hover:bg-surface-container-high">Cancel</button>
              </div>
            </div>
          ) : null}
          <Textarea
            rows={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend().catch((error) => {
                  console.error("Failed to send message", error);
                });
              }
            }}
            disabled={disabled}
            placeholder={
              disabled
                ? "Choose a conversation"
                : composerState.mode === "edit"
                  ? "Update your message..."
                  : "Share a thought with the studio..."
            }
            className="flex-1 bg-transparent border-none focus:ring-0 py-3 px-2 font-body-base text-on-surface resize-none max-h-32 placeholder:text-on-surface-variant/50 min-h-0"
          />
          <Button
            size="icon"
            disabled={disabled || (!value.trim() && !pendingAttachment)}
            onClick={() => {
              handleSend().catch((error) => {
                console.error("Failed to send message", error);
              });
            }}
            className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-full shadow-lg shadow-primary/20 transition-transform active:scale-95 flex-shrink-0 mr-1 disabled:opacity-40"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
      </div>
    </footer>
  );
}
