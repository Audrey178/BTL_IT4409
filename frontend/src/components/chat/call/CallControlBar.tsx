import type { ReactNode } from "react";
import { Camera, CameraOff, Mic, MicOff, MoreHorizontal, PhoneOff, Presentation, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CallControlBarProps {
  micEnabled: boolean;
  cameraEnabled: boolean;
  cameraDisabled?: boolean;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
  endLabel?: string;
  className?: string;
}

function CallControlIcon({
  icon,
  label,
  onClick,
  active = true,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={!active}
      className={cn(
        "flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-full transition-all duration-200",
        active
          ? "bg-surface-container-highest/85 text-on-surface-variant hover:scale-105 hover:bg-surface-container-highest"
          : "bg-error/10 text-error hover:scale-105 hover:bg-error/15",
        disabled && "cursor-not-allowed opacity-50 hover:scale-100",
      )}
    >
      {icon}
      <span className="text-[8px] font-semibold tracking-[0.16em] uppercase">{label}</span>
    </button>
  );
}

export function CallControlBar({
  micEnabled,
  cameraEnabled,
  cameraDisabled = false,
  onToggleMicrophone,
  onToggleCamera,
  onEnd,
  endLabel = "End Call",
  className,
}: CallControlBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-full border border-white/40 bg-[rgba(255,248,243,0.82)] px-4 py-3 shadow-[0_20px_40px_-10px_rgba(140,113,105,0.12)] backdrop-blur-2xl",
        className
      )}
    >
      <CallControlIcon
        icon={micEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        label={micEnabled ? "Mute" : "Unmute"}
        onClick={onToggleMicrophone}
        active={micEnabled}
      />
      <CallControlIcon
        icon={cameraEnabled ? <Camera className="size-4" /> : <CameraOff className="size-4" />}
        label={cameraEnabled ? "Video" : "Camera Off"}
        onClick={onToggleCamera}
        active={cameraEnabled}
        disabled={cameraDisabled}
      />
      <div className="mx-1 h-8 w-px bg-outline-variant/35" />
      <CallControlIcon icon={<Presentation className="size-4" />} label="Share" />
      <CallControlIcon icon={<Smile className="size-4" />} label="React" />
      <CallControlIcon icon={<MoreHorizontal className="size-4" />} label="More" />
      <div className="mx-1 h-8 w-px bg-outline-variant/35" />
      <Button
        variant="destructive"
        onClick={onEnd}
        className="h-12 rounded-full px-6 text-sm font-semibold"
      >
        <PhoneOff className="size-4" />
        {endLabel}
      </Button>
    </div>
  );
}
