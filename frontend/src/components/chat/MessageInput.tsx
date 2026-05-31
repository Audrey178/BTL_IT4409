import { useEffect, useState } from "react";
import { Paperclip, Reply, Send, Smile, SquarePen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ComposerState } from "@/hooks/useMessages";

interface MessageInputProps {
  disabled?: boolean;
  composerState: ComposerState;
  onSend: (content: string) => void | Promise<void>;
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
              onClick={() => {
                setValue("");
                onCancelComposerState();
              }}
              className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-high"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        <div className="flex gap-3 bg-surface-container-low p-2 rounded-3xl border border-outline-variant/20 shadow-editorial focus-within:ring-2 focus-within:ring-primary/10 transition-all items-center">
        <div className="flex-1 flex items-center gap-2 pl-2">
          <button
            type="button"
            disabled={disabled}
            className="p-2 rounded-lg hover:bg-surface-container-highest text-on-surface-variant flex-shrink-0 disabled:opacity-40"
          >
            <Paperclip className="text-xl size-5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            className="p-2 rounded-lg hover:bg-surface-container-highest text-on-surface-variant flex-shrink-0 disabled:opacity-40"
          >
            <Smile className="text-xl size-5" />
          </button>
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
            disabled={disabled || !value.trim()}
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
