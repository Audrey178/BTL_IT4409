import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "@/hooks/useSocket";
import { useLiveKit } from "@/hooks/useLiveKit";
import { useRoomEvents } from "@/hooks/useRoomEvents";
import { useChatEvents } from "@/hooks/useChatEvents";
import { useRecording } from "@/hooks/useRecording";
import { useMediaStore } from "@/stores/mediaStore";
import { useMeetingStore } from "@/stores/meetingStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useVideoFilter } from "@/hooks/useVideoFilter";
import { useFilterStore } from "@/stores/filterStore";
import { ROOM_EVENTS, MEDIA_EVENTS } from "@/socket/events";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff,
  PhoneOff, MessageSquare, Users, X, XCircle,
  Sparkles, CheckCircle2, Badge, MonitorUp, Circle, Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { WaitingRoomPanel } from "@/components/pages/meeting/WaitingRoomPanel";
import { ChatPanel } from "@/components/pages/meeting/ChatPanel";
import { EndMeetingDialog } from "@/components/pages/meeting/EndMeetingDialog";
import ParticipantsPanel from '@/components/pages/meeting/ParticipantsPanel';
import { RecordingBanner } from "@/components/pages/meeting/RecordingBanner";
import { RecordingConsentDialog } from "@/components/pages/meeting/RecordingConsentDialog";
import { StopRecordingDialog } from "@/components/pages/meeting/StopRecordingDialog";
import { roomService } from "@/services/roomService";
import FilterPanel from "@/components/pages/meeting/FilterPanel";

type VideoFilterKey = "original" | "warm" | "mono" | "cool" | "golden";

type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const VIDEO_FILTERS: Record<
  VideoFilterKey,
  { label: string; css: string; accent: string }
> = {
  original: {
    label: "Original",
    css: "none",
    accent: "bg-surface-container-highest",
  },
  warm: {
    label: "Warm",
    css: "sepia(0.25) saturate(1.35) contrast(1.04) brightness(1.02)",
    accent: "bg-orange-200",
  },
  mono: {
    label: "Mono",
    css: "grayscale(1) contrast(1.05)",
    accent: "bg-stone-300",
  },
  cool: {
    label: "Cool",
    css: "saturate(1.15) hue-rotate(20deg) contrast(1.05)",
    accent: "bg-blue-100",
  },
  golden: {
    label: "Golden",
    css: "sepia(0.18) saturate(1.55) brightness(1.08) contrast(1.03)",
    accent: "bg-rose-100",
  },
};

type FaceDetectorInstance = {
  detect: (
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
};

type FaceDetectorConstructor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => FaceDetectorInstance;


export function MeetingScreen() {
  const { id } = useParams<{ id: string }>();
  const roomCode = id?.toUpperCase();
  const socket = useSocket();
  const authUser = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const {
    room,
    isConnected,
    toggleCamera: lkToggleCamera,
    toggleMicrophone: lkToggleMicrophone,
    toggleScreenShare: lkToggleScreenShare,
    disconnect: lkDisconnect,
  } = useLiveKit(roomCode || null);
  useRoomEvents(roomCode || null, lkDisconnect);
  const { sendMessage } = useChatEvents(roomCode || null);
  
  useVideoFilter();

  const {
    isRecording,
    formattedDuration,
    isProcessing,
    startRecording,
    stopRecording,
    showConsentDialog,
    setShowConsentDialog,
  } = useRecording();

  const {
    localStream, isAudioMuted, isVideoMuted,
    screenStream, isScreenSharing,
  } = useMediaStore();

  const {
    participants, isHost, waitingList, hostId,
    removeWaitingUser, screenSharingUserId, setScreenSharingUserId,
  } = useMeetingStore();

  const messageCount = useMeetingStore((s) => s.messages.length);
  const colorFilter = useFilterStore((s) => s.colorFilter);
  const activeAiFilter = useFilterStore((s) => s.activeFilter);
  // When AI filter pipeline is active, canvas already handles color — don't double-apply CSS filter
  const effectiveCssFilter = activeAiFilter !== "none" ? undefined : VIDEO_FILTERS[colorFilter].css;

  const [showChat, setShowChat] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showStopRecordingDialog, setShowStopRecordingDialog] = useState(false);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);
  const [transferringHostId, setTransferringHostId] = useState<string | null>(null);
  const prevMessageCountRef = useRef(messageCount);

  // Track unread messages when chat panel is closed
  useEffect(() => {
    if (messageCount > prevMessageCountRef.current) {
      if (!showChat) {
        setUnreadCount((c) => c + (messageCount - prevMessageCountRef.current));
      }
    }
    prevMessageCountRef.current = messageCount;
  }, [messageCount, showChat]);

  // Listen for invitation decline notifications (only if user is host)
  useEffect(() => {
    if (!isHost || !socket) return;

    const handleDecline = (data: { roomCode: string; userName: string }) => {
      toast.warning(`${data.userName} declined your invitation to join room ${data.roomCode}`);
    };

    socket.on(ROOM_EVENTS.INVITE_DECLINED, handleDecline);

    return () => {
      socket.off(ROOM_EVENTS.INVITE_DECLINED, handleDecline);
    };
  }, [isHost, socket]);

  const handleToggleChat = useCallback(() => {
    const next = !showChat;
    setShowChat(next);
    if (next) setUnreadCount(0);
  }, [showChat]);
  const myUserId = authUser?._id;
  const { reset } = useMeetingStore();
  const { cleanup: cleanupMedia } = useMediaStore();

  // =========================================================================
  // LEAVE / END MEETING HANDLERS
  // =========================================================================

  const handleLeaveMeeting = useCallback(() => {
    // 1. Emit socket leave event
    socket.emit(ROOM_EVENTS.USER_LEFT, { roomCode, userId: myUserId });
    // 2. Disconnect from LiveKit room
    lkDisconnect();
    // 3. Cleanup media tracks (camera, mic, screen share)
    cleanupMedia();
    // 4. Reset meeting store
    reset();
    // 5. Navigate home
    toast.info('You have left the meeting');
    navigate('/', { replace: true });
  }, [socket, roomCode, myUserId, lkDisconnect, cleanupMedia, reset, navigate]);

  const handleEndMeetingForAll = useCallback(async () => {
    if (isEndingMeeting) return; // Double-click prevention
    setIsEndingMeeting(true);
    try {
      // 1. Call REST API to update DB + cleanup Redis
      await roomService.endRoom(roomCode!);
      // 2. Broadcast room:ended via socket to all participants
      socket.emit(ROOM_EVENTS.ENDED, { roomCode });
      // 3. Disconnect from LiveKit room
      lkDisconnect();
      // 4. Cleanup media tracks
      cleanupMedia();
      // 5. Reset meeting store
      reset();
      // 6. Navigate home
      toast.success('Meeting ended for all participants');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error('Failed to end meeting. Please try again.');
      setIsEndingMeeting(false);
    }
  }, [isEndingMeeting, roomCode, socket, lkDisconnect, cleanupMedia, reset, navigate]);

  const handleTransferHost = useCallback(
    async (newHostId: string, participantName: string) => {
      if (!roomCode || !isHost || transferringHostId) return;

      const confirmed = window.confirm(`Transfer host role to ${participantName}?`);
      if (!confirmed) return;

      setTransferringHostId(newHostId);
      try {
        await roomService.transferHost(roomCode, newHostId);
      } catch (error) {
        toast.error('Failed to transfer host role');
      } finally {
        setTransferringHostId(null);
      }
    },
    [roomCode, isHost, transferringHostId]
  );

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

  const meetingStatus = useMeetingStore((s) => s.status);

  useEffect(() => {
    // Only redirect if we were previously in-room and hostId became null
    // (e.g. store was reset). Don't redirect on initial mount when store hasn't hydrated.
    if (!hostId && meetingStatus === 'idle') {
      navigate(`/lobby?code=${roomCode}`);
      socket.emit(ROOM_EVENTS.USER_LEFT, { roomCode, userId: myUserId });
    }
  }, [roomCode, hostId, meetingStatus]);

  // Wrapped toggle handlers — emit socket event after toggle
  const handleToggleAudio = useCallback(async () => {
    if (isConnected) {
      await lkToggleMicrophone();
    } else {
      // Fallback when LiveKit not connected: toggle local audio tracks directly
      const ms = useMediaStore.getState().localStream;
      const currentlyMuted = useMediaStore.getState().isAudioMuted;
      if (ms && ms.getAudioTracks().length > 0) {
        ms.getAudioTracks().forEach(t => { t.enabled = currentlyMuted; });
        useMediaStore.getState().setIsAudioMuted(!currentlyMuted);
      }
    }

    // Read current state from store and emit to others
    const { isAudioMuted, isVideoMuted } = useMediaStore.getState();
    socket.emit(MEDIA_EVENTS.TOGGLE, {
      roomCode, userId: myUserId,
      isAudioMuted,
      isVideoMuted,
    });
  }, [socket, roomCode, myUserId, lkToggleMicrophone]);


  const handleToggleVideo = useCallback(async () => {
    if (isConnected) {
      await lkToggleCamera();
    } else {
      // Fallback when LiveKit not connected: toggle local video tracks directly
      const ms = useMediaStore.getState().localStream;
      const currentlyVideoMuted = useMediaStore.getState().isVideoMuted;
      if (ms && ms.getVideoTracks().length > 0) {
        ms.getVideoTracks().forEach(t => { t.enabled = currentlyVideoMuted; });
        useMediaStore.getState().setIsVideoMuted(!currentlyVideoMuted);
      }
    }

    const { isAudioMuted, isVideoMuted } = useMediaStore.getState();
    socket.emit(MEDIA_EVENTS.TOGGLE, {
      roomCode, userId: myUserId,
      isAudioMuted,
      isVideoMuted,
    });
  }, [socket, roomCode, myUserId, lkToggleCamera]);

  // Screen share handlers
  const handleToggleScreenShare = useCallback(async () => {
    if (!isScreenSharing && screenSharingUserId) {
      toast.error("Someone else is already sharing their screen");
      return;
    }

    const success = await lkToggleScreenShare();
    if (!success) return; // User cancelled picker

    if (!isScreenSharing) {
      // Started sharing
      setScreenSharingUserId(myUserId || null);
      socket.emit(MEDIA_EVENTS.SCREEN_SHARE_START, {
        roomCode, userId: myUserId, userName: authUser?.full_name,
      });
    } else {
      // Stopped sharing
      setScreenSharingUserId(null);
      socket.emit(MEDIA_EVENTS.SCREEN_SHARE_STOP, { roomCode, userId: myUserId });
    }
  }, [socket, roomCode, myUserId, authUser, isScreenSharing, screenSharingUserId, lkToggleScreenShare, setScreenSharingUserId]);

  // Keyboard shortcuts: 'm' toggle mic, 'v' toggle camera
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ignore when typing in inputs
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName?.toLowerCase() || '';
      if (tag === 'input' || tag === 'textarea' || active?.isContentEditable) return;
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleAudio();
      }
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        handleToggleVideo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleToggleAudio, handleToggleVideo]);

  // Get screen share stream to display
  const screenShareStream = isMeSharing
    ? screenStream
    : sharingParticipant?.screenStream || null;

  const totalVisibleTiles = participants.length + 1;
  const meetingGridStyle = totalVisibleTiles >= 4
    ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'repeat(2, minmax(0, 1fr))' }
    : { gridTemplateColumns: `repeat(${totalVisibleTiles}, minmax(0, 1fr))` };

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
          {/* Recording indicator — blinking red dot in header */}
          <RecordingBanner isRecording={isRecording} formattedDuration={formattedDuration} />
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-surface-container rounded-full px-4 py-2">
            <span className="text-sm font-bold text-on-surface">{participants.length + 1} in room</span>
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
              onClick={handleToggleScreenShare}
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
                filterCss={effectiveCssFilter}
              />
              {participants.map((p) => (
                <VideoTile
                  key={p.id}
                  name={p.fullName}
                  stream={p.stream}
                  isMuted={p.isAudioMuted}
                  isVideoOff={p.isVideoMuted}
                  compact
                  showTransferAction={isHost}
                  isTransferPending={transferringHostId === p.id}
                  onTransferHost={() => handleTransferHost(p.id, p.fullName)}
                />
              ))}
            </div>
          </div>
        ) : (
          /* ============ NORMAL GRID MODE ============ */
          <div
            className={`flex-1 grid gap-4 transition-all duration-500 ${showChat ? "mr-0" : ""}`}
            style={meetingGridStyle}
          >
            <VideoTile
              name={authUser?.full_name || "You"}
              stream={localStream}
              isMuted={isAudioMuted}
              isVideoOff={isVideoMuted}
              isLocal={true}
              isHost={isHost}
              filterCss={effectiveCssFilter}
            />
            {participants.map((p) => (
              <VideoTile
                key={p.id}
                name={p.fullName}
                stream={p.stream}
                isMuted={p.isAudioMuted}
                isVideoOff={p.isVideoMuted}
                showTransferAction={isHost}
                isTransferPending={transferringHostId === p.id}
                onTransferHost={() => handleTransferHost(p.id, p.fullName)}
              />
            ))}
          </div>
        )}
        {/* Chat Sidebar */}
        <AnimatePresence>
          {showChat && roomCode && (
            <ChatPanel roomCode={roomCode} onClose={() => setShowChat(false)} sendMessage={sendMessage} />
          )}
        </AnimatePresence>
        {/* Filters Panel */}
        <FilterPanel showFilters={showFilters} setShowFilters={setShowFilters} />
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
              : "px-8 w-auto bg-linear-to-r from-primary to-primary-container text-white shadow-lg shadow-primary/20 border-none"
            }
          />
          <ControlButton icon={<MessageSquare size={24} />} onClick={handleToggleChat} active={showChat} badge={unreadCount > 0 ? unreadCount : undefined} />
          {isHost && roomCode && <WaitingRoomPanel roomCode={roomCode} waitingList={waitingList} removeWaitingUser={removeWaitingUser} />}
          {isHost && roomCode && <ParticipantsPanel roomCode={roomCode} />}
          <ControlButton icon={<Sparkles size={24} />} onClick={() => setShowFilters(!showFilters)} active={showFilters} />
          {isHost && (
            <ControlButton
              icon={
                isRecording ? (
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-red-600 tracking-tight">{formattedDuration}</span>
                  </div>
                ) : (
                  <Circle size={24} className="fill-stone-600/30 text-stone-600 stroke-[3px]" />
                )
              }
              onClick={isRecording ? () => setShowStopRecordingDialog(true) : startRecording}
              active={isRecording}
              className={isRecording ? "w-auto px-4 border-red-200 bg-red-50 hover:bg-red-100 shadow-lg shadow-red-500/10 text-red-600 animate-pulse" : ""}
            />
          )}
          <div className="w-px h-10 bg-outline-variant/30 mx-2" />
          <ControlButton
            icon={<PhoneOff size={24} />}
            className="bg-error text-white shadow-lg shadow-error/20 border-none hover:bg-error/90"
            onClick={() => setShowEndDialog(true)}
          />
        </div>

        {/* Self Preview Floating — hide during presentation mode */}
        {!isAnyoneSharing && (
          <div className="absolute right-8 bottom-8 w-48 aspect-video rounded-2xl overflow-hidden border-2 border-primary shadow-2xl bg-stone-900">
            {/* Local Video Preview */}
            <div className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${localStream && !isVideoMuted ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
              {localStream && <SelfPreviewVideo stream={localStream} filterCss={effectiveCssFilter} />}
            </div>
            {/* Avatar Fallback */}
            <div className={`absolute inset-0 w-full h-full flex items-center justify-center transition-opacity duration-500 ${localStream && !isVideoMuted ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"}`}>
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-surface-container-highest text-on-surface-variant text-lg">
                  {authUser?.full_name?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        )}
      </div>

      {/* End Meeting Dialog */}
      <EndMeetingDialog
        open={showEndDialog}
        onOpenChange={setShowEndDialog}
        isHost={!!isHost}
        onLeave={handleLeaveMeeting}
        onEndForAll={handleEndMeetingForAll}
        isLoading={isEndingMeeting}
      />

      {/* Recording Consent Dialog — non-host participants */}
      <RecordingConsentDialog
        open={showConsentDialog}
        onOpenChange={setShowConsentDialog}
      />

      {/* Stop Recording Dialog — host confirmation */}
      <StopRecordingDialog
        open={showStopRecordingDialog}
        onOpenChange={setShowStopRecordingDialog}
        onConfirm={stopRecording}
        isProcessing={isProcessing}
        formattedDuration={formattedDuration}
      />
    </div>
  );
}

/* ====================== Sub-components ====================== */

function ScreenShareVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => console.warn("Screen share play error:", err));
    }
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain bg-black" />;
}

function SelfPreviewVideo({ stream, filterCss }: { stream: MediaStream, filterCss?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(err => console.warn("Self preview play error:", err));
    }
    // Apply CSS filter only when no AI filter is active (canvas handles it otherwise)
    el.style.filter = filterCss && filterCss !== "none" ? filterCss : "";
  }, [stream, filterCss]);
  return <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />;
}

function VideoTile({
  name, stream, isMuted = false, isVideoOff = false,
  isHost = false, isLocal = false, compact = false, filterCss,
  showTransferAction = false, isTransferPending = false, onTransferHost,
}: {
  name: string; stream?: MediaStream | null; isMuted?: boolean;
  isVideoOff?: boolean; isHost?: boolean; isLocal?: boolean; compact?: boolean; filterCss?: string;
  showTransferAction?: boolean; isTransferPending?: boolean; onTransferHost?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      // Chỉ gán lại srcObject nếu stream thực sự thay đổi
      // Việc gán lại srcObject liên tục (ngay cả khi stream giống hệt) 
      // sẽ khiến browser lập tức abort quá trình play trước đó, gây ra AbortError.
      if (videoRef.current.srcObject !== (stream ?? null)) {
        console.log("[LiveKit Debug] [VideoTile] Stream changed, setting new srcObject for", name, "| stream:", !!stream);
        videoRef.current.srcObject = stream ?? null;
      }
      
      if (filterCss) {
        videoRef.current.style.filter = filterCss;
      }
      
      if (isVideoOff || !stream) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch((err) => {
          if (err.name !== "AbortError") {
             console.warn("[LiveKit Debug] VideoTile play error:", err);
          }
        });
      }
    }
  }, [stream, isVideoOff, filterCss, name, isLocal]);

  return (
    <div className={`relative overflow-hidden bg-stone-900 shadow-sm group transition-all duration-500 flex flex-col justify-center items-center ${
      compact ? "rounded-2xl aspect-video" : "rounded-[2.5rem]"
    } ${isHost && !compact ? "scale-[1.02] border-2 border-primary/20" : ""}`}>
      
      {/* Video Container (always in DOM, smooth transition) */}
      <div className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${stream && !isVideoOff ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover -scale-x-100" />
      </div>

      {/* Avatar Fallback Container (always in DOM, smooth transition) */}
      <div className={`absolute inset-0 w-full h-full flex items-center justify-center transition-opacity duration-500 ${stream && !isVideoOff ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"}`}>
        <Avatar className={compact ? "w-10 h-10" : "w-24 h-24"}>
          <AvatarFallback className={`bg-surface-container-highest text-on-surface-variant ${compact ? "text-lg" : "text-4xl"}`}>
            {name?.[0]?.toUpperCase() || "G"}
          </AvatarFallback>
        </Avatar>
      </div>
      
      <div className={`absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 ${
        compact ? "text-[10px]" : "text-sm bottom-6 left-6 gap-3 px-4 py-2"
      }`}>
        {isMuted ? <MicOff size={compact ? 10 : 14} className="text-error" /> : <Mic size={compact ? 10 : 14} />}
        <span className="font-bold truncate max-w-20">{name}</span>
        {isHost && !compact && (
          <span className="text-[10px] text-primary-fixed bg-primary/20 px-1.5 py-0.5 rounded">Host</span>
        )}
      </div>

      {showTransferAction && !isLocal && onTransferHost && (
        <button
          type="button"
          onClick={onTransferHost}
          disabled={isTransferPending}
          className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/45 text-white border border-white/15 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-black/65 disabled:opacity-60"
        >
          <Crown size={12} />
          {isTransferPending ? 'Transferring...' : 'Make host'}
        </button>
      )}
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
      title={label}
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


