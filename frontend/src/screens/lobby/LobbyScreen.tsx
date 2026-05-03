import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useMedia } from "@/hooks/useMedia";
import { useMediaStore } from "@/stores/mediaStore";
import { useMeetingStore } from "@/stores/meetingStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSocket } from "@/hooks/useSocket";
import { ROOM_EVENTS } from "@/socket/events";
import { roomService } from "@/services/roomService";
import type { Room } from "@/types";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Settings,
  ChevronLeft,
  Bell,
  HelpCircle,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { WaitingScreen } from "@/components/pages/lobby/WaitingScreen";
import { TopNav } from "@/components/layout/TopNav";

export function LobbyScreen() {
  const [searchParams] = useSearchParams();
  const roomCode = searchParams.get("code");

  const { requestMedia } = useMedia();
  const { localStream, isAudioMuted, isVideoMuted, toggleAudio, toggleVideo } =
    useMediaStore();
  const { setRoomCode, setHostId, setIsHost, setStatus, status, setMemberId, addParticipant } =
    useMeetingStore();
  const authUser = useAuthStore((s) => s.user);
  const socket = useSocket();
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  const [roomInfo, setRoomInfo] = useState<Room | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [joining, setJoining] = useState(false);
  const [displayName, setDisplayName] = useState(authUser?.full_name || "");
  const [copied, setCopied] = useState(false);

  // Fetch room info
  useEffect(() => {
    if (!roomCode) {
      navigate("/", { replace: true });
      return;
    }

    const fetchRoom = async () => {
      try {
        const res = await roomService.getRoomInfo(roomCode);
        if (res.success && res.room) {
          setRoomInfo(res.room);
          setRoomCode(roomCode);

          const hostId =
            typeof res.room.host_id === "object"
              ? res.room.host_id._id
              : res.room.host_id;
          setHostId(hostId);
          setIsHost(hostId === authUser?._id);
        }
      } catch (err: unknown) {
        const error = err as {
          response?: { status?: number; data?: { message?: string } };
        };
        if (error.response?.status === 404) {
          toast.error("Room not found");
        } else if (error.response?.status === 409) {
          toast.error("This meeting has ended");
        } else {
          toast.error("Failed to load room info");
        }
        navigate("/", { replace: true });
      } finally {
        setLoadingRoom(false);
      }
    };

    fetchRoom();
  }, [
    roomCode,
    navigate,
    setRoomCode,
    setHostId,
    setIsHost,
    authUser,
  ]);

  // Request media on mount
  useEffect(() => {
    requestMedia();
  }, [requestMedia]);

  // Attach local stream to video element
  useEffect(() => {
    if (videoRef.current && localStream && !isVideoMuted) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoMuted]);

  // Listen for socket events when joining
  useEffect(() => {
    if (!socket || !roomCode) return;

    const handlePending = () => {
      setStatus("waiting");
    };

    const handleUserJoined = (data: {
      success?: boolean;
      userId?: string;
      isSelf?: boolean;
      existingParticipants?: Array<{ userId: string; userName: string }>;
    }) => {
      // Helper: store existing participants before navigate
      const storeParticipants = () => {
        if (data.existingParticipants) {
          data.existingParticipants.forEach(p => {
            addParticipant({
              id: p.userId,
              fullName: p.userName,
              isActive: true,
              isAudioMuted: false,
              isVideoMuted: false,
            });
          });
        }
      };

      // Trường hợp 1: Không cần approve — server gửi success
      if (data.success) {
        storeParticipants();
        setStatus('in-room');
        navigate(`/meeting/${roomCode}`, { replace: true });
        return;
      }

      // Trường hợp 2: User được host approve — server gửi isSelf: true
      if (data.isSelf) {
        storeParticipants();
        setStatus('in-room');
        navigate(`/meeting/${roomCode}`, { replace: true });
        return;
      }

      // Các event khác (broadcast khi ai đó join) — bỏ qua ở Lobby
    };

    const handleUserRejected = () => {
      setStatus("idle");
      setJoining(false);
      toast.error("Your request to join was denied by the host");
      navigate("/", { replace: true });
    };

    const handleError = (data: { message?: string }) => {
      toast.error(data.message || "An error occurred");
      setJoining(false);
    };

    socket.on(ROOM_EVENTS.PENDING, handlePending);
    socket.on(ROOM_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(ROOM_EVENTS.USER_REJECTED, handleUserRejected);
    socket.on(ROOM_EVENTS.ERROR, handleError);

    return () => {
      socket.off(ROOM_EVENTS.PENDING, handlePending);
      socket.off(ROOM_EVENTS.USER_JOINED, handleUserJoined);
      socket.off(ROOM_EVENTS.USER_REJECTED, handleUserRejected);
      socket.off(ROOM_EVENTS.ERROR, handleError);
    };
  }, [socket, roomCode, authUser, navigate, setStatus, addParticipant]);

  const handleJoin = async () => {
    if (!roomCode || !authUser) return;
    setJoining(true);

    try {
      // Call REST API to register join
      const res = await roomService.joinRoom(roomCode);
      const { roomMember } = res;
      setMemberId(roomMember._id);
      if (res.status === "pending") {
        // Need approval — emit socket event and show waiting screen
        socket.emit(ROOM_EVENTS.JOIN, {
          userId: authUser._id,
          roomCode,
          user: authUser,
        });
        setStatus("waiting");
      } else if (res.status === "joined") {
        // No approval needed — emit socket and go directly to meeting
        socket.emit(ROOM_EVENTS.JOIN, {
          userId: authUser._id,
          roomCode,
          user: authUser,
        });
        setStatus("in-room");
        navigate(`/meeting/${roomCode}`, { replace: true });
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string } };
      };
      toast.error(error.response?.data?.message || "Failed to join meeting");
      setJoining(false);
    }
  };

  const handleCopyCode = async () => {
    if (roomCode) {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast.success("Room code copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Show waiting screen if status is 'waiting'
  if (status === "waiting") {
    return <WaitingScreen />;
  }

  // Loading state
  if (loadingRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={40} />
          <p className="text-on-surface-variant font-bold text-sm">
            Loading room...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Top Nav */}
      <TopNav />

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
              {roomInfo && (
                <div className="space-y-2">
                  <p className="text-on-surface-variant text-lg max-w-md">
                    {roomInfo.title}
                  </p>
                  {roomInfo.description && (
                    <p className="text-on-surface-variant/60 text-sm max-w-md">
                      {roomInfo.description}
                    </p>
                  )}
                </div>
              )}
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
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full h-16 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-bold text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {joining ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={22} />
                      Joining...
                    </>
                  ) : (
                    "Join Meeting"
                  )}
                </Button>

                {/* Room Code Display */}
                {roomCode && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <p className="text-[10px] text-on-surface-variant font-bold tracking-widest uppercase opacity-50">
                      Meeting ID: {roomCode}
                    </p>
                    <button
                      onClick={handleCopyCode}
                      className="text-primary/50 hover:text-primary transition-colors"
                      aria-label="Copy room code"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                )}

                {/* Approval badge */}
                {roomInfo?.settings?.require_approval && (
                  <p className="text-center text-[10px] text-primary/60 font-bold tracking-widest uppercase mt-3">
                    ⏳ This room requires host approval
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Video Preview */}
          <div className="lg:col-span-7 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-video bg-surface-container-highest rounded-[2.5rem] overflow-hidden shadow-2xl border border-outline-variant/10 flex justify-center items-center"
            >
              {localStream && !isVideoMuted ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900 text-stone-500">
                  <VideoOff size={64} className="mb-4 opacity-50" />
                  <span>Camera is off</span>
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
                  icon={isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  label={isAudioMuted ? "Unmute" : "Mute"}
                  active={!isAudioMuted}
                  onClick={toggleAudio}
                />
                <LobbyControl
                  icon={isVideoMuted ? <VideoOff size={24} /> : <Video size={24} />}
                  label={isVideoMuted ? "Start Video" : "Stop Video"}
                  active={!isVideoMuted}
                  onClick={toggleVideo}
                />
                <div className="w-px h-10 bg-outline-variant/30 mx-2" />
                <LobbyControl
                  icon={<Settings size={24} />}
                  label="Setup"
                  onClick={() => { }}
                />
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
                  Others are in the room
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
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${active
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
