import { PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { ConversationCallParticipant } from "@/hooks/chat/useWebRTCCall";
import type { CallSessionState } from "@/stores/messageStore";
import { ActiveCallView } from "./call/ActiveCallView";
import { IncomingCallCard } from "./call/IncomingCallCard";

interface CallDialogProps {
  call: CallSessionState | null;
  localStream: MediaStream | null;
  remoteParticipants: ConversationCallParticipant[];
  error: string | null;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onClose: () => void;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
}

function TerminalCallState({
  title,
  description,
  onClose,
}: {
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-[32px] border border-outline-variant/20 bg-[rgba(255,255,255,0.8)] p-10 text-center shadow-[0_24px_60px_-16px_rgba(140,113,105,0.22)] backdrop-blur-2xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-error/10 text-error">
          <PhoneOff className="size-8" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-on-surface">{title}</h2>
        <p className="mt-3 text-sm text-on-surface-variant">{description}</p>
        <div className="mt-8 flex justify-center">
          <Button variant="outline" className="rounded-full px-6" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CallDialog({
  call,
  localStream,
  remoteParticipants,
  error,
  isMicEnabled,
  isCameraEnabled,
  onAccept,
  onReject,
  onEnd,
  onClose,
  onToggleMicrophone,
  onToggleCamera,
}: CallDialogProps) {
  if (!call) {
    return null;
  }

  const isRinging = call.state === "ringing-incoming" || call.state === "ringing-outgoing";
  const isActive = call.state === "active" || call.state === "connecting";

  return (
    <Dialog open={Boolean(call)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-[rgba(51,48,45,0.16)] p-0 ring-0 backdrop-blur-md sm:max-w-none"
      >
        {isRinging ? (
          <IncomingCallCard
            call={call}
            localStream={localStream}
            remoteParticipants={remoteParticipants}
            error={error}
            onAccept={onAccept}
            onReject={onReject}
            onClose={onClose}
          />
        ) : null}

        {isActive ? (
          <ActiveCallView
            call={call}
            localStream={localStream}
            remoteParticipants={remoteParticipants}
            error={error}
            isMicEnabled={isMicEnabled}
            isCameraEnabled={isCameraEnabled}
            onToggleMicrophone={onToggleMicrophone}
            onToggleCamera={onToggleCamera}
            onEnd={onEnd}
          />
        ) : null}

        {call.state === "ended" ? (
          <TerminalCallState
            title="Call ended"
            description="The call has been finished. You can close this view and return to messages."
            onClose={onClose}
          />
        ) : null}

        {call.state === "rejected" ? (
          <TerminalCallState
            title="Call declined"
            description="The other participant declined the call."
            onClose={onClose}
          />
        ) : null}

        {call.state === "missed" ? (
          <TerminalCallState
            title="Missed call"
            description="No one joined the call before it timed out."
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
