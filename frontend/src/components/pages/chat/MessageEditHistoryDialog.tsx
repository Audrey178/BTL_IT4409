import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MessageEditHistoryItem } from "@/services/chatService";

interface MessageEditHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  edits: MessageEditHistoryItem[];
}

export function MessageEditHistoryDialog({
  open,
  onOpenChange,
  edits,
}: MessageEditHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl border-outline-variant/20 bg-surface-container-lowest p-0">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-on-surface">Edit history</DialogTitle>
            <DialogDescription>Recent content updates for this message.</DialogDescription>
          </DialogHeader>

          <div className="mt-5 max-h-96 space-y-3 overflow-auto pr-1">
            {edits.map((edit) => (
              <div key={edit.editId} className="rounded-2xl bg-surface-container-high px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant">
                  v{edit.fromVersion} to v{edit.toVersion}
                </p>
                <p className="mt-2 text-sm text-on-surface-variant line-through">{edit.previousContent}</p>
                <p className="mt-2 text-sm text-on-surface">{edit.newContent}</p>
              </div>
            ))}
            {edits.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No edits recorded.</p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
