import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useRoomEvents } from "@/hooks/useRoomEvents";
import { useMediaStore } from "@/stores/mediaStore";
import { useMeetingStore } from "@/stores/meetingStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { ROOM_EVENTS, MEDIA_EVENTS } from "@/socket/events";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff,
  PhoneOff, MessageSquare, Users, X, Send, XCircle,
  Sparkles, CheckCircle2, Badge, MonitorUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { WaitingRoomPanel } from "@/components/pages/meeting/WaitingRoomPanel";

export function MeetingScreen() {
  const { id: roomCode } = useParams<{ id: string }>();
  const socket = useSocket();
  const authUser = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const { replaceVideoTrack } = useWebRTC(roomCode || null);
  useRoomEvents(roomCode || null);

  const {
    localStream, isAudioMuted, isVideoMuted, toggleAudio, toggleVideo,
    screenStream, isScreenSharing, setScreenStream, setIsScreenSharing,
  } = useMediaStore();

  const {
    participants, messages, isHost, waitingList, hostId,
    removeWaitingUser, screenSharingUserId, setScreenSharingUserId,
  } = useMeetingStore();

  const [showChat, setShowChat] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const myUserId = authUser?._id;

  // Is someone (me or remote) sharing screen?
  const isAnyoneSharing = isScreenSharing || !!screenSharingUserId;
  const isMeSharing = isScreenSharing;

  // Find the sharing participant's info (for remote share)
  const sharingParticipant = screenSharingUserId
    ? participants.find((p) => p.id === screenSharingUserId)
    : null;

  const presenterName = isMeSharing
    ? `${authUser?.full_name || "You"} (You, presenting)`
    : sharingParticipant?.fullName || "Someone";

  useEffect(() => {
    if (!hostId) {
      navigate(`/lobby?code=${roomCode}`);
      socket.emit(ROOM_EVENTS.USER_LEFT, { roomId: roomCode, userId: myUserId });
    }
  }, [roomCode, hostId]);

  // Wrapped toggle handlers — emit socket event after toggle
  const handleToggleAudio = useCallback(() => {
    toggleAudio();
    const newMuted = !useMediaStore.getState().isAudioMuted;
    socket.emit(MEDIA_EVENTS.TOGGLE, {
      roomCode, userId: myUserId,
      isAudioMuted: newMuted,
      isVideoMuted: useMediaStore.getState().isVideoMuted,
    });
  }, [socket, roomCode, myUserId, toggleAudio]);

  const handleToggleVideo = useCallback(() => {
    toggleVideo();
    const newMuted = !useMediaStore.getState().isVideoMuted;
    socket.emit(MEDIA_EVENTS.TOGGLE, {
      roomCode, userId: myUserId,
      isAudioMuted: useMediaStore.getState().isAudioMuted,
      isVideoMuted: newMuted,
    });
  }, [socket, roomCode, myUserId, toggleVideo]);

  // Screen share handlers
  const handleStartScreenShare = useCallback(async () => {
    if (screenSharingUserId) {
      toast.error("Someone else is already sharing their screen");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setScreenStream(stream);
      setIsScreenSharing(true);
      setScreenSharingUserId(myUserId || null);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        replaceVideoTrack(videoTrack);
        videoTrack.onended = () => handleStopScreenShare();
      }

      socket.emit(MEDIA_EVENTS.SCREEN_SHARE_START, {
        roomCode, userId: myUserId, userName: authUser?.full_name,
      });
    } catch {
      // User cancelled the picker
    }
  }, [socket, roomCode, myUserId, authUser, screenSharingUserId, replaceVideoTrack, setScreenStream, setIsScreenSharing, setScreenSharingUserId]);

  const handleStopScreenShare = useCallback(() => {
    const { screenStream: ss } = useMediaStore.getState();
    if (ss) {
      ss.getTracks().forEach((t) => t.stop());
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    setScreenSharingUserId(null);

    // Replace back to camera track
    const { localStream: ls } = useMediaStore.getState();
    const camTrack = ls?.getVideoTracks()[0];
    if (camTrack) replaceVideoTrack(camTrack);

    socket.emit(MEDIA_EVENTS.SCREEN_SHARE_STOP, { roomCode, userId: myUserId });
  }, [socket, roomCode, myUserId, replaceVideoTrack, setScreenStream, setIsScreenSharing, setScreenSharingUserId]);

  const handleToggleScreenShare = useCallback(() => {
    if (isScreenSharing) handleStopScreenShare();
    else handleStartScreenShare();
  }, [isScreenSharing, handleStartScreenShare, handleStopScreenShare]);

  // Get screen share stream to display
  const screenShareStream = isMeSharing
    ? screenStream
    : sharingParticipant?.stream || null;

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <header className="bg-surface-container-low/50 backdrop-blur-xl px-8 py-4 flex justify-between items-center border-b border-outline-variant/10 z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tighter text-orange-900">The Digital Hearth</h1>
          <div className="px-3 py-1 bg-primary/10 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Live: {roomCode}</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-surface-container rounded-full px-4 py-2">
            <Users size={16} className="text-on-surface-variant" />
            <span className="text-sm font-bold text-on-surface">{participants.length + 1}</span>
          </div>
          <div className="flex items-center gap-3 bg-white/50 px-4 py-2 rounded-full border border-outline-variant/20">
            <Avatar className="w-8 h-8">
              <AvatarFallback>{authUser?.full_name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
            <span className="font-bold text-orange-900 text-sm">{authUser?.full_name || "You"}</span>
            {isHost && (
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-[10px] px-2">Host</Badge>
            )}
          </div>
        </div>
      </header>

      {/* Presenter Banner */}
      <AnimatePresence>
        {isMeSharing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-primary/10 border-b border-primary/20 px-8 py-3 flex items-center justify-between z-40"
          >
            <div className="flex items-center gap-3">
              <MonitorUp size={18} className="text-primary" />
              <span className="text-sm font-bold text-primary">{presenterName}</span>
              <span className="text-xs text-primary/60">· Presentation audio</span>
            </div>
            <Button
              onClick={handleStopScreenShare}
              variant="destructive"
              size="sm"
              className="rounded-full px-6 font-bold text-xs"
            >
              Stop presenting
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden p-6 gap-6 relative">
        {/* ============ PRESENTATION MODE ============ */}
        {isAnyoneSharing ? (
          <div className="flex-1 flex gap-4">
            {/* Main: Screen Share Tile */}
            <div className="flex-1 relative rounded-[2.5rem] overflow-hidden bg-stone-900 shadow-sm border border-outline-variant/10">
              {screenShareStream ? (
                <ScreenShareVideo stream={screenShareStream} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-on-surface-variant/40">
                  <MonitorUp size={64} className="opacity-30" />
                </div>
              )}
              <div className="absolute bottom-6 left-6 flex items-center gap-3 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-white text-sm border border-white/10">
                <MonitorUp size={14} className="text-primary" />
                <span className="font-bold">Presenting: {presenterName}</span>
              </div>
            </div>

            {/* Right Filmstrip */}
            <div className="w-48 flex flex-col gap-3 overflow-y-auto scrollbar-hide">
              <VideoTile
                name={authUser?.full_name || "You"}
                stream={localStream}
                isMuted={isAudioMuted}
                isVideoOff={isVideoMuted}
                isLocal={true}
                isHost={isHost}
                compact
              />
              {participants.map((p) => (
                <VideoTile
                  key={p.id}
                  name={p.fullName}
                  stream={p.stream}
                  isMuted={p.isAudioMuted}
                  isVideoOff={p.isVideoMuted}
                  compact
                />
              ))}
            </div>
          </div>
        ) : (
          /* ============ NORMAL GRID MODE ============ */
          <div className={`flex-1 grid grid-cols-2 grid-rows-2 gap-4 transition-all duration-500 ${showChat ? "mr-0" : ""}`}>
            <VideoTile
              name={authUser?.full_name || "You"}
              stream={localStream}
              isMuted={isAudioMuted}
              isVideoOff={isVideoMuted}
              isLocal={true}
              isHost={isHost}
            />
            {participants.map((p) => (
              <VideoTile
                key={p.id}
                name={p.fullName}
                stream={p.stream}
                isMuted={p.isAudioMuted}
                isVideoOff={p.isVideoMuted}
              />
            ))}
          </div>
        )}

        {/* Chat Sidebar */}
        <AnimatePresence>
          {showChat && (
            <motion.aside
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-80 flex flex-col bg-surface-container-low rounded-[2rem] shadow-sm overflow-hidden border border-outline-variant/10"
            >
              <div className="p-6 bg-surface-container-high flex justify-between items-center border-b border-outline-variant/10">
                <h3 className="font-bold text-on-surface">Meeting Chat</h3>
                <button onClick={() => setShowChat(false)} className="text-on-surface-variant hover:text-primary transition-colors">
                  <X size={20} />
                </button>
              </div>
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                      <MessageSquare size={24} className="text-on-surface-variant/30 mb-2" />
                      <p className="text-xs text-on-surface-variant/40">No messages yet</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <ChatMessage
                        key={msg.id}
                        name={msg.senderName}
                        time={new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        message={msg.content}
                        isSelf={msg.senderId === myUserId}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
              <div className="p-6 bg-surface-container-low border-t border-outline-variant/10">
                <div className="relative">
                  <input
                    className="w-full h-12 bg-surface-container-highest border-none rounded-2xl px-4 pr-12 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/40"
                    placeholder="Send a message..."
                  />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors">
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 20 }}
              className="absolute top-6 right-6 w-80 max-h-[calc(100%-120px)] glass-panel rounded-[2.5rem] shadow-2xl border border-white/40 flex flex-col overflow-hidden z-[60]"
            >
              <div className="p-8 pb-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-orange-950 tracking-tight">Studio Filters</h2>
                <button onClick={() => setShowFilters(false)} className="text-on-surface-variant hover:text-primary transition-colors">
                  <X size={20} />
                </button>
              </div>
              <ScrollArea className="flex-1 px-8 pb-8">
                <div className="space-y-8">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-4">Focus & Backgrounds</p>
                    <div className="grid grid-cols-2 gap-4">
                      <FilterItem label="Original" active icon={<XCircle size={24} />} />
                      <FilterItem label="Soft Blur" src="https://picsum.photos/seed/blur/200/120" blur />
                      <FilterItem label="Oak Studio" src="https://picsum.photos/seed/oak/200/120" />
                      <FilterItem label="The Hearth" src="https://picsum.photos/seed/hearth/200/120" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-4">Mood & Color</p>
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                      <ColorFilter color="bg-orange-200" label="Warm" />
                      <ColorFilter color="bg-stone-300" label="Mono" />
                      <ColorFilter color="bg-blue-100" label="Cool" />
                      <ColorFilter color="bg-rose-100" label="Golden" />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="bg-surface-container-low p-6 flex items-center justify-between mt-auto border-t border-outline-variant/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Sparkles size={18} className="text-primary" />
                  </div>
                  <span className="text-sm font-bold text-orange-950">Auto-Touchup</span>
                </div>
                <Switch defaultChecked />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls Bar */}
      <div className="h-24 bg-surface-container-low/30 flex items-center justify-center px-8 relative z-50">
        <div className="flex items-center gap-4 bg-white/80 backdrop-blur-2xl px-8 py-4 rounded-full shadow-2xl border border-white/40">
          <ControlButton
            icon={isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
            onClick={handleToggleAudio}
            active={isAudioMuted}
          />
          <ControlButton
            icon={isVideoMuted ? <VideoOff size={24} /> : <Video size={24} />}
            onClick={handleToggleVideo}
            active={isVideoMuted}
          />
          <div className="w-px h-10 bg-outline-variant/30 mx-2" />
          <ControlButton
            icon={isScreenSharing ? <ScreenShareOff size={24} /> : <ScreenShare size={24} />}
            label={isScreenSharing ? "Stop Share" : "Share Screen"}
            onClick={handleToggleScreenShare}
            active={isScreenSharing}
            className={isScreenSharing
              ? "px-8 w-auto bg-error text-white shadow-lg shadow-error/20 border-none"
              : "px-8 w-auto bg-gradient-to-r from-primary to-primary-container text-white shadow-lg shadow-primary/20 border-none"
            }
          />
          <ControlButton icon={<MessageSquare size={24} />} onClick={() => setShowChat(!showChat)} active={showChat} />
          <ControlButton icon={<Users size={24} />} badge={participants.length + 1} />
          {isHost && <WaitingRoomPanel roomCode={roomCode} waitingList={waitingList} removeWaitingUser={removeWaitingUser} />}
          <ControlButton icon={<Sparkles size={24} />} onClick={() => setShowFilters(!showFilters)} active={showFilters} />
          <div className="w-px h-10 bg-outline-variant/30 mx-2" />
          <ControlButton
            icon={<PhoneOff size={24} />}
            className="bg-error text-white shadow-lg shadow-error/20 border-none hover:bg-error/90"
            onClick={() => { }}
          />
        </div>

        {/* Self Preview Floating — hide during presentation mode */}
        {!isAnyoneSharing && (
          <div className="absolute right-8 bottom-8 w-48 aspect-video rounded-2xl overflow-hidden border-2 border-primary shadow-2xl">
            {localStream && !isVideoMuted ? (
              <SelfPreviewVideo stream={localStream} />
            ) : (
              <div className="w-full h-full bg-stone-900 flex items-center justify-center">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-surface-container-highest text-on-surface-variant text-lg">
                    {authUser?.full_name?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================== Sub-components ====================== */

function ScreenShareVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain bg-black" />;
}

function SelfPreviewVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />;
}

function VideoTile({
  name, stream, isMuted = false, isVideoOff = false,
  isHost = false, isLocal = false, compact = false,
}: {
  name: string; stream?: MediaStream | null; isMuted?: boolean;
  isVideoOff?: boolean; isHost?: boolean; isLocal?: boolean; compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && !isVideoOff) videoRef.current.srcObject = stream ?? null;
  }, [stream, isVideoOff]);

  return (
    <div className={`relative overflow-hidden bg-stone-900 shadow-sm group transition-all duration-500 flex flex-col justify-center items-center ${
      compact ? "rounded-2xl aspect-video" : "rounded-[2.5rem]"
    } ${isHost && !compact ? "scale-[1.02] border-2 border-primary/20" : ""}`}>
      {stream && !isVideoOff ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover -scale-x-100" />
      ) : (
        <Avatar className={compact ? "w-10 h-10" : "w-24 h-24"}>
          <AvatarFallback className={`bg-surface-container-highest text-on-surface-variant ${compact ? "text-lg" : "text-4xl"}`}>
            {name?.[0]?.toUpperCase() || "G"}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={`absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 ${
        compact ? "text-[10px]" : "text-sm bottom-6 left-6 gap-3 px-4 py-2"
      }`}>
        {isMuted ? <MicOff size={compact ? 10 : 14} className="text-error" /> : <Mic size={compact ? 10 : 14} />}
        <span className="font-bold truncate max-w-[80px]">{name}</span>
        {isHost && !compact && (
          <span className="text-[10px] text-primary-fixed bg-primary/20 px-1.5 py-0.5 rounded">Host</span>
        )}
      </div>
    </div>
  );
}

function ChatMessage({ name, time, message, isSelf = false }: {
  name: string; time: string; message: string; isSelf?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${isSelf ? "items-end" : ""}`}>
      <div className="flex justify-between w-full items-end px-1">
        {!isSelf && <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface">{name}</span>}
        <span className="text-[10px] text-on-surface-variant/40 uppercase tracking-widest">{time}</span>
        {isSelf && <span className="text-[10px] font-bold uppercase tracking-widest text-primary">You</span>}
      </div>
      <div className={`p-4 rounded-3xl text-sm shadow-sm border ${
        isSelf ? "bg-primary text-white rounded-tr-none border-primary" : "bg-white text-on-surface rounded-tl-none border-outline-variant/10"
      }`}>
        {message}
      </div>
    </div>
  );
}

function ControlButton({ icon, label, active = false, badge, className, onClick }: {
  icon: React.ReactNode; label?: string; active?: boolean;
  badge?: number; className?: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-90 border border-outline-variant/20 ${
        active ? "bg-secondary-container text-primary border-primary/20" : "bg-surface-container-highest text-on-surface-variant hover:bg-orange-100"
      } ${className}`}
    >
      {icon}
      {label && <span className="ml-2 font-bold text-sm">{label}</span>}
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function FilterItem({ label, active = false, src, icon, blur = false }: {
  label: string; active?: boolean; src?: string; icon?: React.ReactNode; blur?: boolean;
}) {
  return (
    <button className="flex flex-col gap-2 text-left group">
      <div className={`aspect-video w-full rounded-2xl overflow-hidden relative border-2 transition-all ${
        active ? "border-primary ring-4 ring-primary-fixed" : "border-transparent hover:border-outline-variant"
      } ${!src ? "bg-surface-container-highest flex items-center justify-center" : ""}`}>
        {src ? <img src={src} alt={label} className={`w-full h-full object-cover ${blur ? "blur-[2px]" : ""}`} /> : icon}
        {active && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="text-primary" size={24} />
          </div>
        )}
      </div>
      <span className={`text-[10px] font-bold px-1 uppercase tracking-widest ${active ? "text-primary" : "text-on-surface-variant/60"}`}>
        {label}
      </span>
    </button>
  );
}

function ColorFilter({ color, label }: { color: string; label: string }) {
  return (
    <button className="flex-shrink-0 w-16 flex flex-col items-center gap-2 group">
      <div className={`w-12 h-12 rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-110 ${color}`} />
      <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest">{label}</span>
    </button>
  );
}
