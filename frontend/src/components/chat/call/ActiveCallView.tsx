import { LayoutGrid, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { CallSessionState } from "@/stores/messageStore";
import type { ConversationCallParticipant } from "@/hooks/chat/useWebRTCCall";
import { CallControlBar } from "./CallControlBar";
import { CallMediaTile } from "./CallMediaTile";

interface ActiveCallViewProps {
  call: CallSessionState;
  localStream: MediaStream | null;
  remoteParticipants: ConversationCallParticipant[];
  error: string | null;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
}

const formatDuration = (durationSeconds?: number) => {
  const seconds = durationSeconds || 0;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

function ActiveCallHeader({
  call,
  remoteParticipants,
}: {
  call: CallSessionState;
  remoteParticipants: ConversationCallParticipant[];
}) {
  const isGroup = call.targetUserIds.length > 1;
  const participantCount = call.targetUserIds.length + 1;

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
      <div className="flex items-center gap-4">
        <div className="rounded-2xl border border-outline-variant/15 bg-white/70 px-4 py-3 shadow-[0_10px_30px_-10px_rgba(140,113,105,0.16)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight text-primary">The Hearth</span>
            <div className="h-5 w-px bg-outline-variant/40" />
            <div>
              <p className="text-sm font-semibold text-on-surface">{call.callerName}</p>
              <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">
                {isGroup ? "Group call" : "Direct call"}
              </p>
            </div>
          </div>
        </div>
        <Badge className="bg-error/10 text-error hover:bg-error/10">
          LIVE {formatDuration(call.durationSeconds)}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-white/70 text-on-surface-variant shadow-sm backdrop-blur-xl"
        >
          <LayoutGrid className="size-4" />
        </button>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-white/70 text-on-surface-variant shadow-sm backdrop-blur-xl"
        >
          <UserPlus className="size-4" />
        </button>
        <AvatarGroup>
          <Avatar size="lg">
            <AvatarFallback>{call.callerName.slice(0, 2)}</AvatarFallback>
          </Avatar>
          {remoteParticipants.slice(0, 2).map((participant) => (
            <Avatar key={participant.userId} size="lg">
              <AvatarFallback>{participant.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
          ))}
          {participantCount > 3 ? <AvatarGroupCount>+{participantCount - 3}</AvatarGroupCount> : null}
        </AvatarGroup>
      </div>
    </header>
  );
}

function OneToOneCallStage({
  call,
  localStream,
  remoteParticipants,
}: {
  call: CallSessionState;
  localStream: MediaStream | null;
  remoteParticipants: ConversationCallParticipant[];
}) {
  const remote = remoteParticipants[0] || null;

  return (
    <div className="relative min-h-0 flex-1 px-6 pb-32 pt-2 sm:px-10">
      <div className="relative h-full min-h-0 overflow-hidden rounded-[32px] shadow-[0_24px_60px_-16px_rgba(140,113,105,0.18)]">
        <CallMediaTile
          label={remote?.name || call.callerName}
          stream={remote?.stream || null}
          videoEnabled={call.callType === "video"}
          emphasis="speaker"
          badgeLabel="Live"
        />
      </div>

      <div className="absolute bottom-36 right-10 z-20 h-[220px] w-[160px] overflow-hidden rounded-[24px] border-4 border-white shadow-2xl sm:h-[320px] sm:w-[240px]">
        <CallMediaTile
          label="You"
          stream={localStream}
          videoEnabled={call.callType === "video"}
          muted
          emphasis="self"
        />
      </div>
    </div>
  );
}

function GroupCallStage({
  call,
  localStream,
  remoteParticipants,
}: {
  call: CallSessionState;
  localStream: MediaStream | null;
  remoteParticipants: ConversationCallParticipant[];
}) {
  const tiles = [
    ...remoteParticipants.map((participant, index) => ({
      key: participant.userId,
      label: participant.name,
      stream: participant.stream,
      videoEnabled: call.callType === "video",
      emphasis: index === 0 ? ("speaker" as const) : ("default" as const),
      badgeLabel: index === 0 ? "Speaking" : null,
      muted: false,
    })),
    {
      key: "self",
      label: "You",
      stream: localStream,
      videoEnabled: call.callType === "video",
      emphasis: "default" as const,
      badgeLabel: "Preview",
      muted: true,
    },
  ];

  return (
    <div className="grid min-h-0 flex-1 auto-rows-fr gap-6 px-6 pb-32 pt-2 sm:grid-cols-2 sm:px-10">
      {tiles.map((tile) => (
        <CallMediaTile
          key={tile.key}
          label={tile.label}
          stream={tile.stream}
          videoEnabled={tile.videoEnabled}
          emphasis={tile.emphasis}
          badgeLabel={tile.badgeLabel}
          muted={tile.muted}
        />
      ))}
    </div>
  );
}

export function ActiveCallView({
  call,
  localStream,
  remoteParticipants,
  error,
  isMicEnabled,
  isCameraEnabled,
  onToggleMicrophone,
  onToggleCamera,
  onEnd,
}: ActiveCallViewProps) {
  const isGroup = call.targetUserIds.length > 1;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,181,158,0.18),_transparent_28%),linear-gradient(180deg,_rgba(255,248,243,1)_0%,_rgba(243,237,232,1)_100%)]">
      <ActiveCallHeader call={call} remoteParticipants={remoteParticipants} />

      {isGroup ? (
        <GroupCallStage call={call} localStream={localStream} remoteParticipants={remoteParticipants} />
      ) : (
        <OneToOneCallStage call={call} localStream={localStream} remoteParticipants={remoteParticipants} />
      )}

      {error ? (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-error/10 px-4 py-2 text-sm text-error">
          {error}
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_top,rgba(255,255,255,0.35),transparent_42%)]" />

      <footer className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
        <div className="pointer-events-auto">
          <CallControlBar
            micEnabled={isMicEnabled}
            cameraEnabled={isCameraEnabled}
            cameraDisabled={call.callType !== "video"}
            onToggleMicrophone={onToggleMicrophone}
            onToggleCamera={onToggleCamera}
            onEnd={onEnd}
            endLabel={isGroup ? "End Call" : "Leave"}
          />
        </div>
      </footer>
    </div>
  );
}
