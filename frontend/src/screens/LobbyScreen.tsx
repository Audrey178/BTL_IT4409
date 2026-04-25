import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Settings,
  ChevronLeft,
  Bell,
  HelpCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router";

export function LobbyScreen() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(true);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializePreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
        }
      } catch {
        if (isMounted) {
          setCameraError(
            "Khong the truy cap camera. Vui long kiem tra quyen truy cap tren trinh duyet."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCamera(false);
        }
      }
    };

    initializePreview();

    return () => {
      isMounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) {
      return;
    }

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
  }, [isMuted]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) {
      return;
    }

    stream.getVideoTracks().forEach((track) => {
      track.enabled = !isVideoOff;
    });
  }, [isVideoOff]);

  const joinMeeting = () => {
    sessionStorage.setItem(
      "meeting-media-preferences",
      JSON.stringify({
        isMuted,
        isVideoOff,
        displayName,
      })
    );
    navigate("/meeting");
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Top Nav */}
      <nav className="bg-surface/80 backdrop-blur-xl sticky top-0 z-50 border-b border-outline-variant/10">
        <div className="max-w-screen-2xl mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <button
              onClick={() => {}}
              className="text-on-surface-variant hover:text-primary transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <span className="text-2xl font-bold tracking-tighter text-orange-900">
              The Digital Hearth
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-on-surface-variant">
            <button className="hover:text-primary transition-colors">
              Meetings
            </button>
            <button className="hover:text-primary transition-colors">
              Recordings
            </button>
            <button className="hover:text-primary transition-colors">
              Settings
            </button>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-on-surface-variant"
            >
              <Bell size={20} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-on-surface-variant"
            >
              <HelpCircle size={20} />
            </Button>
            <Avatar className="w-10 h-10">
              <AvatarImage src="https://i.pravatar.cc/100?u=me" />
              <AvatarFallback>EV</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </nav>

      <main className="flex-grow flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          {/* Left: Content */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-4">
              <span className="text-primary font-bold tracking-widest text-xs uppercase">
                Online Meeting Lobby
              </span>
              <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-on-surface leading-[1.1]">
                Step into the <br />
                <span className="text-primary">Studio.</span>
              </h1>
              <p className="text-on-surface-variant text-lg max-w-md">
                Check your lighting and sound before joining the conversation.
                Your digital presence matters.
              </p>
            </div>

            <div className="bg-surface-container-low p-8 rounded-3xl space-y-6 editorial-shadow border border-outline-variant/10">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                  Display Name
                </label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-14 bg-surface-container-highest border-none rounded-2xl px-6 text-on-surface placeholder:text-on-surface-variant/50 focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="How should we call you?"
                />
              </div>
              <div className="pt-4">
                <Button
                  onClick={joinMeeting}
                  className="w-full h-16 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-bold text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Join Meeting
                </Button>
                <p className="text-center text-[10px] text-on-surface-variant mt-6 font-bold tracking-widest uppercase opacity-50">
                  Meeting ID: HEARTH-2024-STUDIO
                </p>
              </div>
            </div>
          </div>

          {/* Right: Video Preview */}
          <div className="lg:col-span-7 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-video bg-surface-container-highest rounded-[2.5rem] overflow-hidden shadow-2xl border border-outline-variant/10"
            >
              {!cameraError ? (
                <video
                  ref={previewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                  <div className="text-center px-8">
                    <AlertCircle className="mx-auto mb-3 text-error" size={28} />
                    <p className="text-sm text-on-surface-variant">{cameraError}</p>
                  </div>
                </div>
              )}

              {isLoadingCamera && !cameraError && (
                <div className="absolute inset-0 bg-surface/60 backdrop-blur-sm flex items-center justify-center text-xs font-bold tracking-widest uppercase text-on-surface-variant">
                  Dang khoi tao camera...
                </div>
              )}

              {isVideoOff && (
                <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center text-white/90">
                    <VideoOff className="mx-auto mb-3" size={34} />
                    <p className="text-sm font-bold uppercase tracking-widest">
                      Camera is off
                    </p>
                  </div>
                </div>
              )}

              {/* Overlay */}
              <div className="absolute top-6 left-6 bg-surface-bright/80 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 border border-outline-variant/20">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold text-on-surface tracking-tight uppercase">
                  Live Preview
                </span>
              </div>

              {/* Controls */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-4 bg-surface-bright/90 backdrop-blur-xl rounded-full border border-outline-variant/20 shadow-2xl">
                <LobbyControl
                  icon={isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  label={isMuted ? "Unmute" : "Mute"}
                  active={!isMuted}
                  onClick={() => setIsMuted((prev) => !prev)}
                />
                <LobbyControl
                  icon={isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                  label={isVideoOff ? "Start Video" : "Stop Video"}
                  active={!isVideoOff}
                  onClick={() => setIsVideoOff((prev) => !prev)}
                />
                <div className="w-px h-10 bg-outline-variant/30 mx-2" />
                <LobbyControl icon={<Settings size={24} />} label="Setup" />
              </div>
            </motion.div>

            {/* Floating Participants */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute -bottom-6 -right-6 bg-white p-4 rounded-2xl shadow-xl border border-outline-variant/10 hidden md:block"
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {[1, 2].map((i) => (
                    <Avatar key={i} className="w-8 h-8 border-2 border-white">
                      <AvatarImage
                        src={`https://i.pravatar.cc/100?u=${i + 10}`}
                      />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <p className="text-xs font-bold text-on-surface-variant">
                  4 others are in the room
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <footer className="w-full py-8 border-t border-outline-variant/10 bg-surface-container-low/30">
        <div className="max-w-screen-2xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-bold tracking-widest uppercase opacity-50 text-on-surface-variant">
            © 2024 Digital Hearth. Designed for human connection.
          </p>
          <div className="flex gap-8 text-[10px] font-bold tracking-widest uppercase opacity-50 text-on-surface-variant">
            <button className="hover:text-primary transition-colors">
              Privacy Policy
            </button>
            <button className="hover:text-primary transition-colors">
              Terms of Service
            </button>
            <button className="hover:text-primary transition-colors">
              Security
            </button>
            <button className="hover:text-primary transition-colors">
              Status
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LobbyControl({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 group">
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${
          active
            ? "bg-primary text-white shadow-lg shadow-primary/20"
            : "bg-surface-container-highest text-on-surface-variant hover:bg-surface-variant"
        }`}
      >
        {icon}
      </div>
      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
        {label}
      </span>
    </button>
  );
}
