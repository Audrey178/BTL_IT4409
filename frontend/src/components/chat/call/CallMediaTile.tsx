import { useEffect, useRef } from "react";
import { Mic, MicOff, UserRound, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CallMediaTileProps {
  label: string;
  stream: MediaStream | null;
  videoEnabled: boolean;
  muted?: boolean;
  emphasis?: "default" | "speaker" | "self";
  badgeLabel?: string | null;
  className?: string;
}

export function CallMediaTile({
  label,
  stream,
  videoEnabled,
  muted = false,
  emphasis = "default",
  badgeLabel = null,
  className,
}: CallMediaTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideoTrack = Boolean(
    videoEnabled &&
      stream?.getVideoTracks().some((track) => track.readyState === "live" && track.enabled)
  );
  const hasAudioTrack = Boolean(
    stream?.getAudioTracks().some((track) => track.readyState === "live" && track.enabled)
  );

  return (
    <div
      className={cn(
        "group relative h-full min-h-0 w-full overflow-hidden rounded-[28px] border border-outline-variant/15 bg-surface-container-highest shadow-[0_20px_40px_-10px_rgba(140,113,105,0.12)]",
        emphasis === "speaker" && "border-primary/70 shadow-[0_0_30px_rgba(128,35,0,0.15)]",
        emphasis === "self" && "border-white/60 shadow-2xl",
        className
      )}
    >
      {hasVideoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,181,158,0.28),_transparent_45%),linear-gradient(180deg,_rgba(243,237,232,1)_0%,_rgba(232,225,220,1)_100%)]">
          <div className="flex flex-col items-center gap-4 text-on-surface-variant">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/70 shadow-lg">
              {videoEnabled ? <Video className="size-10" /> : <UserRound className="size-10" />}
            </div>
            <p className="text-sm font-medium tracking-[0.08em] uppercase">{label}</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(29,27,24,0.68)] via-transparent to-transparent" />

      <div className="absolute bottom-5 left-5 flex items-center gap-3">
        <span className="text-sm font-semibold text-white">{label}</span>
        {badgeLabel ? (
          <Badge className="bg-primary/90 text-white hover:bg-primary/90">{badgeLabel}</Badge>
        ) : null}
      </div>

      <div className="absolute right-5 top-5 flex items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white backdrop-blur-sm",
            hasAudioTrack ? "text-white/90" : "text-red-200"
          )}
        >
          {hasAudioTrack ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        </div>
      </div>
    </div>
  );
}
