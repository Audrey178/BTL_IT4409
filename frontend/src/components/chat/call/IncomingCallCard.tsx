import { Phone, PhoneOff, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CallSessionState } from "@/stores/messageStore";
import type { ConversationCallParticipant } from "@/hooks/useWebRTCCall";
import { CallMediaTile } from "./CallMediaTile";

interface IncomingCallCardProps {
  call: CallSessionState;
  localStream: MediaStream | null;
  remoteParticipants: ConversationCallParticipant[];
  error: string | null;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}

const statusCopy: Record<CallSessionState["state"], string> = {
  "ringing-incoming": "Incoming studio call",
  "ringing-outgoing": "Calling...",
  connecting: "Connecting...",
  active: "Live",
  ended: "Call ended",
  rejected: "Call declined",
  missed: "Missed call",
  idle: "",
};

export function IncomingCallCard({
  call,
  localStream,
  remoteParticipants,
  error,
  onAccept,
  onReject,
  onClose,
}: IncomingCallCardProps) {
  const isIncoming = call.state === "ringing-incoming";
  const participantCount = call.targetUserIds.length + 1;
  const remotePreview = remoteParticipants[0] || null;

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center px-6 py-6">
      <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-outline-variant/20 bg-[rgba(255,255,255,0.72)] shadow-[0_24px_60px_-16px_rgba(140,113,105,0.22)] backdrop-blur-2xl">
        <div className="overflow-y-auto p-8 sm:p-10">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="space-y-3">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Studio Call</Badge>
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-on-surface">
                  {call.callerName}
                </h2>
                <p className="mt-2 flex items-center gap-2 text-sm text-on-surface-variant">
                  <span className="relative inline-flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                  </span>
                  {statusCopy[call.state]}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-3 text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              <PhoneOff className="size-5" />
            </button>
          </div>

          <div className="mb-10 flex items-center justify-between gap-4 rounded-3xl bg-surface-container-low/80 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Call members
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                {participantCount} participants in this session
              </p>
            </div>
            <AvatarGroup>
              <Avatar size="lg">
                <AvatarFallback>{call.callerName.slice(0, 2)}</AvatarFallback>
              </Avatar>
              {call.targetUserIds.slice(0, 2).map((targetId) => (
                <Avatar key={targetId} size="lg">
                  <AvatarFallback>{targetId.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              ))}
              {call.targetUserIds.length > 2 ? (
                <AvatarGroupCount>+{call.targetUserIds.length - 2}</AvatarGroupCount>
              ) : null}
            </AvatarGroup>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="aspect-[4/5] min-h-[240px]">
              <CallMediaTile
                label={remotePreview?.name || call.callerName}
                stream={remotePreview?.stream || null}
                videoEnabled={call.callType === "video"}
                badgeLabel={isIncoming ? "Waiting" : "Dialing"}
              />
            </div>

            <div className="aspect-[4/5] min-h-[240px]">
              <CallMediaTile
                label="You"
                stream={localStream}
                videoEnabled={call.callType === "video"}
                muted
                emphasis="self"
                badgeLabel="Preview"
              />
            </div>
          </div>

          {error ? <p className="mt-5 text-sm text-error">{error}</p> : null}

          <div className="mt-10 flex items-center justify-center gap-4">
            <Button
              variant="destructive"
              onClick={isIncoming ? onReject : onClose}
              className="h-14 rounded-full px-6"
            >
              <PhoneOff className="size-4" />
              {isIncoming ? "Decline" : "Close"}
            </Button>

            {isIncoming ? (
              <Button onClick={onAccept} className="h-16 rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/30">
                {call.callType === "video" ? <Video className="size-5" /> : <Phone className="size-5" />}
                Accept Call
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
