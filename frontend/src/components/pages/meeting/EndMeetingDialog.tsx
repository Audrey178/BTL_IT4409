import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogOut, PhoneOff, Loader2 } from "lucide-react";

interface EndMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isHost: boolean;
  onLeave: () => void;
  onEndForAll: () => void;
  isLoading: boolean;
}

export function EndMeetingDialog({
  open,
  onOpenChange,
  isHost,
  onLeave,
  onEndForAll,
  isLoading,
}: EndMeetingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-outline-variant/20 bg-white/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-bold text-orange-950 tracking-tight">
            {isHost ? "Leave or end meeting?" : "Leave meeting?"}
          </DialogTitle>
          <DialogDescription className="text-on-surface-variant/80 text-sm leading-relaxed mt-2">
            {isHost
              ? "You can leave the meeting or end it for all participants."
              : "Are you sure you want to leave the meeting?"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          {/* Leave meeting — available for everyone */}
          <button
            onClick={onLeave}
            disabled={isLoading}
            className="flex items-center gap-4 p-4 rounded-2xl border border-outline-variant/20 bg-surface-container hover:bg-orange-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
              <LogOut size={20} className="text-orange-700" />
            </div>
            <div className="text-left">
              <p className="font-bold text-orange-950 text-sm">Leave meeting</p>
              <p className="text-xs text-on-surface-variant/60 mt-0.5">
                {isHost
                  ? "You'll leave, but others can stay"
                  : "You'll be removed from the meeting"}
              </p>
            </div>
          </button>

          {/* End meeting for all — host only */}
          {isHost && (
            <button
              onClick={onEndForAll}
              disabled={isLoading}
              className="flex items-center gap-4 p-4 rounded-2xl border border-red-200 bg-red-50 hover:bg-red-100 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                {isLoading ? (
                  <Loader2 size={20} className="text-red-600 animate-spin" />
                ) : (
                  <PhoneOff size={20} className="text-red-600" />
                )}
              </div>
              <div className="text-left">
                <p className="font-bold text-red-700 text-sm">End meeting for all</p>
                <p className="text-xs text-red-500/80 mt-0.5">
                  Everyone will be removed from the meeting
                </p>
              </div>
            </button>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="rounded-full px-6 font-bold text-on-surface-variant"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
