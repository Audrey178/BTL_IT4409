import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Circle,
  Square,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  MessageSquare,
  Users,
  Bell,
  HelpCircle,
  X,
  Send,
  XCircle,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useMediaStore } from "@/stores/mediaStore";
import { useMeetingStore } from "@/stores/meetingStore";
import { useRecordingStore } from "@/stores/recordingStore";

type MeetingMediaPreferences = {
  isMuted: boolean;
  isVideoOff: boolean;
  displayName?: string;
};

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

function getInitialMediaPreferences(): MeetingMediaPreferences {
  const fallback = { isMuted: false, isVideoOff: false, displayName: "" };

  const savedPreferences = sessionStorage.getItem("meeting-media-preferences");
  if (!savedPreferences) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(savedPreferences);
    return {
      isMuted: Boolean(parsed.isMuted),
      isVideoOff: Boolean(parsed.isVideoOff),
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
    };
  } catch {
    return fallback;
  }
}

export function MeetingScreen() {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const getInitialFilter = () => {
    try {
      const url = new URL(window.location.href);
      const f = url.searchParams.get('filter');
      if (f && (f === 'original' || f === 'warm' || f === 'mono' || f === 'cool' || f === 'golden')) {
        return f as VideoFilterKey;
      }
    } catch {}
    const saved = sessionStorage.getItem('selectedFilter');
    if (saved && (saved === 'original' || saved === 'warm' || saved === 'mono' || saved === 'cool' || saved === 'golden')) {
      return saved as VideoFilterKey;
    }
    return 'original' as VideoFilterKey;
  };

  const [selectedFilter, setSelectedFilter] = useState<VideoFilterKey>(getInitialFilter);
  const [faceOverlayEnabled, setFaceOverlayEnabled] = useState(false);
  const [faceDetectionSupported, setFaceDetectionSupported] = useState(false);
  const [faceBoxes, setFaceBoxes] = useState<FaceBox[]>([]);
  const selfPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [applyOutgoing, setApplyOutgoing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const params = useParams();
  const roomId = params.id ?? null;
  const { replaceOutgoingTrack } = useWebRTC(roomId) as any;
  const { localStream, isAudioMuted, isVideoMuted, toggleAudio, toggleVideo } = useMediaStore();
  const presenterName = useMeetingStore((s) => s.participants.find((p: any) => p.isHost)?.fullName ?? 'Host');
  const setRecording = useRecordingStore((s) => s.setRecording);
  const currentVideoFilter = VIDEO_FILTERS[selectedFilter].css;

  useEffect(() => {
    // apply to self preview element
    if (selfPreviewRef.current) {
      selfPreviewRef.current.style.filter = VIDEO_FILTERS[selectedFilter].css;
    }
    // persist and update URL
    try {
      sessionStorage.setItem('selectedFilter', selectedFilter);
      const url = new URL(window.location.href);
      url.searchParams.set('filter', selectedFilter);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, [selectedFilter]);

  const startCanvasPipeline = useCallback((filterCss: string) => {
    if (!localStream || !replaceOutgoingTrack) return;

    // Create offscreen video element
    let v = offscreenVideoRef.current;
    if (!v) {
      v = document.createElement('video');
      v.autoplay = true;
      v.muted = true;
      v.playsInline = true;
      offscreenVideoRef.current = v;
    }
    v.srcObject = localStream;

    // Create canvas
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!v || v.readyState < 2) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      const w = v.videoWidth || 640;
      const h = v.videoHeight || 480;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.filter = filterCss === 'none' ? 'none' : filterCss;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const stream = (canvas as HTMLCanvasElement).captureStream(30);
    canvasStreamRef.current = stream;

    const track = stream.getVideoTracks()[0];
    if (track) {
      replaceOutgoingTrack(track);
    }
  }, [localStream, replaceOutgoingTrack]);

  const stopCanvasPipeline = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (canvasStreamRef.current) {
      canvasStreamRef.current.getTracks().forEach(t => t.stop());
      canvasStreamRef.current = null;
    }
    if (replaceOutgoingTrack) {
      // revert to original local video track
      const orig = localStream?.getVideoTracks()?.[0] ?? null;
      replaceOutgoingTrack(orig ?? null);
    }
  }, [localStream, replaceOutgoingTrack]);

  useEffect(() => {
    if (applyOutgoing) {
      const filterCss = VIDEO_FILTERS[selectedFilter].css;
      startCanvasPipeline(filterCss);
    } else {
      stopCanvasPipeline();
    }
    return () => {
      // cleanup on unmount
      stopCanvasPipeline();
    };
  }, [applyOutgoing, selectedFilter, startCanvasPipeline, stopCanvasPipeline]);

  const startRecording = useCallback(() => {
    if (isRecording) {
      return;
    }

    if (!localStream) {
      toast.error("Camera stream is not ready yet.");
      return;
    }

    if (!window.MediaRecorder) {
      toast.error("This browser does not support recording.");
      return;
    }

    const supportedMimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mimeType = supportedMimeTypes.find((type) => window.MediaRecorder!.isTypeSupported(type));

    recordedChunksRef.current = [];
    recordingStartedAtRef.current = Date.now();

    const recorder = new MediaRecorder(
      localStream,
      mimeType ? { mimeType } : undefined
    );

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const chunks = recordedChunksRef.current;
      const startedAt = recordingStartedAtRef.current ?? Date.now();
      const durationMs = Date.now() - startedAt;

      if (!chunks.length) {
        setIsRecording(false);
        toast.error("No recording data was captured.");
        return;
      }

      const blob = new Blob(chunks, {
        type: mimeType ?? "video/webm",
      });
      const url = URL.createObjectURL(blob);

      setRecording({
        id: crypto.randomUUID(),
        title: `Meeting recording ${new Date().toLocaleDateString()}`,
        roomId,
        url,
        mimeType: blob.type,
        size: blob.size,
        durationMs,
        createdAt: new Date(startedAt).toISOString(),
      });

      setIsRecording(false);
      navigate("/recording");
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    toast.success("Recording started.");
  }, [isRecording, localStream, navigate, roomId, setRecording]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      setIsRecording(false);
      return;
    }

    recorder.stop();
    mediaRecorderRef.current = null;
    toast.success("Recording stopped.");
  }, []);

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <header className="bg-surface-container-low/50 backdrop-blur-xl px-8 py-4 flex justify-between items-center border-b border-outline-variant/10 z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tighter text-orange-900">
            The Digital Hearth
          </h1>
          <div className="px-3 py-1 bg-primary/10 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
              Live: Strategy Session
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-2">
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
          </div>
          <div className="flex items-center gap-3 bg-white/50 px-4 py-2 rounded-full border border-outline-variant/20">
            <Avatar className="w-8 h-8">
              <AvatarImage src="https://i.pravatar.cc/100?u=me" />
              <AvatarFallback>EV</AvatarFallback>
            </Avatar>
            <span className="font-bold text-orange-900 text-sm">
              {presenterName}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden p-6 gap-6 relative">
        {/* Video Grid */}
        <div
          className={`flex-1 grid grid-cols-2 grid-rows-2 gap-4 transition-all duration-500 ${showChat ? "mr-0" : ""}`}
        >
          {/* Local User */}
          <VideoTile
            name="Marcus Chen (Host)"
            isHost
            src="https://picsum.photos/seed/host/800/600"
          />
          <VideoTile
            name="Sarah Jenkins"
            src="https://picsum.photos/seed/sarah/800/600"
          />
          <VideoTile
            name="David Miller"
            isMuted
            src="https://picsum.photos/seed/david/800/600"
          />
          <div className="relative rounded-3xl overflow-hidden bg-stone-900 shadow-sm flex items-center justify-center">
              <div className="absolute inset-0 opacity-50 bg-linear-to-br from-orange-900 to-stone-900 flex flex-col items-center justify-center text-center p-8">
              <ScreenShare size={64} className="text-orange-200 mb-4" />
              <h3 className="text-orange-50 font-bold text-xl">
                Presentation in Progress
              </h3>
              <p className="text-orange-200/70 text-sm mt-2">
                Sarah is sharing her screen
              </p>
            </div>
            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full text-white text-xs">
              <ScreenShare size={14} />
              <span className="font-medium">Sarah's Screen</span>
            </div>
          </div>
        </div>

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
                <button
                  onClick={() => setShowChat(false)}
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  <ChatMessage
                    name="Marcus Chen"
                    time="10:42 AM"
                    message="Welcome everyone! Let's dive into the Q3 goals."
                    color="text-orange-800"
                  />
                  <ChatMessage
                    name="Sarah Jenkins"
                    time="10:45 AM"
                    message="I've prepared the slide deck for the marketing segment. Ready to share when needed!"
                    color="text-stone-600"
                  />
                  <div className="text-center py-2">
                    <span className="text-[10px] font-bold text-on-surface-variant/40 bg-surface-container-high px-3 py-1 rounded-full uppercase tracking-widest">
                      David Miller joined
                    </span>
                  </div>
                  <ChatMessage
                    name="You"
                    time="10:47 AM"
                    message="Thanks Sarah, let's look at those after the budget update."
                    isSelf
                  />
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
              <div className="pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Apply Filter to Outgoing Stream</label>
                  <Switch checked={applyOutgoing} onCheckedChange={(v) => setApplyOutgoing(Boolean(v))} />
                </div>
                <p className="text-xs text-on-surface-variant mt-2">When enabled, selected studio filter is rendered to a canvas and sent to peers instead of the raw camera.</p>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Filters Panel Overlay */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 20 }}
              className="absolute top-6 right-6 w-80 max-h-[calc(100%-120px)] glass-panel rounded-[2.5rem] shadow-2xl border border-white/40 flex flex-col overflow-hidden z-60"
            >
              <div className="p-8 pb-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-orange-950 tracking-tight">
                  Studio Filters
                </h2>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <ScrollArea className="flex-1 px-8 pb-8">
                <div className="space-y-8">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-4">
                      Video Filters
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <FilterItem
                        label="Original"
                        active={selectedFilter === "original"}
                        icon={<XCircle size={24} />}
                        onClick={() => setSelectedFilter("original")}
                      />
                      <FilterItem
                        label="Warm"
                        src="https://picsum.photos/seed/warm/200/120"
                        active={selectedFilter === "warm"}
                        onClick={() => setSelectedFilter("warm")}
                      />
                      <FilterItem
                        label="Mono"
                        src="https://picsum.photos/seed/mono/200/120"
                        active={selectedFilter === "mono"}
                        onClick={() => setSelectedFilter("mono")}
                      />
                      <FilterItem
                        label="Cool"
                        src="https://picsum.photos/seed/cool/200/120"
                        active={selectedFilter === "cool"}
                        onClick={() => setSelectedFilter("cool")}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-4">
                      Color Presets
                    </p>
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                      <ColorFilter
                        color={VIDEO_FILTERS.warm.accent}
                        label="Warm"
                        active={selectedFilter === "warm"}
                        onClick={() => setSelectedFilter("warm")}
                      />
                      <ColorFilter
                        color={VIDEO_FILTERS.mono.accent}
                        label="Mono"
                        active={selectedFilter === "mono"}
                        onClick={() => setSelectedFilter("mono")}
                      />
                      <ColorFilter
                        color={VIDEO_FILTERS.cool.accent}
                        label="Cool"
                        active={selectedFilter === "cool"}
                        onClick={() => setSelectedFilter("cool")}
                      />
                      <ColorFilter
                        color={VIDEO_FILTERS.golden.accent}
                        label="Golden"
                        active={selectedFilter === "golden"}
                        onClick={() => setSelectedFilter("golden")}
                      />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="bg-surface-container-low p-6 flex items-center justify-between mt-auto border-t border-outline-variant/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Sparkles size={18} className="text-primary" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-orange-950">
                      Face Tracking
                    </span>
                    <span className="block text-[10px] text-on-surface-variant/60">
                      Experimental browser face detection
                    </span>
                  </div>
                </div>
                <Switch
                  checked={faceOverlayEnabled}
                  onCheckedChange={setFaceOverlayEnabled}
                  disabled={!faceDetectionSupported}
                />
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
            onClick={toggleAudio}
            active={isAudioMuted}
          />
          <ControlButton
            icon={isVideoMuted ? <VideoOff size={24} /> : <Video size={24} />}
            onClick={toggleVideo}
            active={isVideoMuted}
          />
          <div className="w-px h-10 bg-outline-variant/30 mx-2" />
          <ControlButton
            icon={<ScreenShare size={24} />}
            label="Share Screen"
            className="px-8 w-auto bg-linear-to-r from-primary to-primary-container text-white shadow-lg shadow-primary/20 border-none"
          />
          <ControlButton
            icon={<MessageSquare size={24} />}
            onClick={() => setShowChat(!showChat)}
            active={showChat}
          />
          <ControlButton icon={<Users size={24} />} badge={12} />
          <ControlButton
            icon={<Sparkles size={24} />}
            onClick={() => setShowFilters(!showFilters)}
            active={showFilters}
          />
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex h-14 items-center gap-3 rounded-full border px-5 text-sm font-bold transition-all active:scale-90 ${isRecording ? "border-red-300 bg-red-500 text-white shadow-lg shadow-red-500/20" : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"}`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${isRecording ? "bg-white/15" : "bg-red-500 text-white"}`}>
              {isRecording ? <Square size={16} /> : <Circle size={16} fill="currentColor" />}
            </span>
            {isRecording ? "Stop Record" : "Record"}
          </button>
          <div className="w-px h-10 bg-outline-variant/30 mx-2" />
          <ControlButton
            icon={<PhoneOff size={24} />}
            className="bg-error text-white shadow-lg shadow-error/20 border-none hover:bg-error/90"
            onClick={() => {}}
          />
        </div>

        {/* Self Preview Floating */}
        <div className="absolute right-8 bottom-8 w-48 aspect-video rounded-2xl overflow-hidden border-2 border-primary shadow-2xl">
          {!cameraError ? (
            <video
              ref={selfPreviewRef}
              autoPlay
              muted
              playsInline
              style={{ filter: currentVideoFilter }}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-surface-container-high flex items-center justify-center p-3 text-center">
              <div>
                <AlertCircle className="mx-auto text-error" size={18} />
                <p className="text-[10px] mt-1 text-on-surface-variant">Camera blocked</p>
              </div>
            </div>
          )}

          {!isCameraReady && !cameraError && (
            <div className="absolute inset-0 bg-surface/70 backdrop-blur-sm flex items-center justify-center text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">
              Loading...
            </div>
          )}

          {isVideoOff && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center text-white text-center">
              <div>
                <VideoOff className="mx-auto mb-1" size={18} />
                <p className="text-[10px] font-bold uppercase tracking-widest">Camera Off</p>
              </div>
            </div>
          )}

          {faceOverlayEnabled && faceDetectionSupported && faceBoxes.length > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {faceBoxes.map((box, index) => (
                <div
                  key={`${index}-${box.x}-${box.y}`}
                  className="absolute rounded-2xl border-2 border-primary/80"
                  style={{
                    left: box.x,
                    top: box.y,
                    width: box.width,
                    height: box.height,
                  }}
                >
                  <span className="absolute -top-6 left-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
                    Face
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] text-white font-bold">
            {presenterName} {isVideoOff ? "(Hidden)" : "(Live)"}
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoTile({ name, stream, isMuted = false, isVideoOff = false, isHost = false, isLocal = false }: any) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className={`relative rounded-[2.5rem] overflow-hidden bg-stone-900 shadow-sm group transition-all duration-500 flex flex-col justify-center items-center ${isHost ? "scale-[1.02] border-2 border-primary/20" : ""}`}
    >
      {stream && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover -scale-x-100"
        />
      ) : (
        <Avatar className="w-24 h-24">
          <AvatarFallback className="bg-surface-container-highest text-on-surface-variant text-4xl">{name?.[0]}</AvatarFallback>
        </Avatar>
      )}
      <div className="absolute bottom-6 left-6 flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full text-white text-sm border border-white/10">
        {isMuted ? (
          <MicOff size={14} className="text-error" />
        ) : (
          <Mic size={14} />
        )}
        <span className="font-bold">{name}</span>
      </div>
    </div>
  );
}

function ChatMessage({
  name,
  time,
  message,
  isSelf = false,
  color = "text-on-surface",
}: any) {
  return (
    <div className={`flex flex-col gap-1.5 ${isSelf ? "items-end" : ""}`}>
      <div className="flex justify-between w-full items-end px-1">
        {!isSelf && (
          <span
            className={`text-[10px] font-bold uppercase tracking-widest ${color}`}
          >
            {name}
          </span>
        )}
        <span className="text-[10px] text-on-surface-variant/40 uppercase tracking-widest">
          {time}
        </span>
        {isSelf && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            You
          </span>
        )}
      </div>
      <div
        className={`p-4 rounded-3xl text-sm shadow-sm border ${
          isSelf
            ? "bg-primary text-white rounded-tr-none border-primary"
            : "bg-white text-on-surface rounded-tl-none border-outline-variant/10"
        }`}
      >
        {message}
      </div>
    </div>
  );
}

function ControlButton({
  icon,
  label,
  active = false,
  badge,
  className,
  onClick,
}: any) {
  return (
    <button
      onClick={onClick}
      className={`relative h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-90 border border-outline-variant/20 ${
        active
          ? "bg-secondary-container text-primary border-primary/20"
          : "bg-surface-container-highest text-on-surface-variant hover:bg-orange-100"
      } ${className}`}
    >
      {icon}
      {label && <span className="ml-2 font-bold text-sm">{label}</span>}
      {badge && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function FilterItem({ label, active = false, src, icon, blur = false, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col gap-2 text-left group">
      <div
        className={`aspect-video w-full rounded-2xl overflow-hidden relative border-2 transition-all ${
          active
            ? "border-primary ring-4 ring-primary-fixed"
            : "border-transparent hover:border-outline-variant"
        } ${!src ? "bg-surface-container-highest flex items-center justify-center" : ""}`}
      >
        {src ? (
          <img
            src={src}
            alt={label}
            className={`w-full h-full object-cover ${blur ? "blur-[2px]" : ""}`}
          />
        ) : (
          icon
        )}
        {active && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="text-primary" size={24} />
          </div>
        )}
      </div>
      <span
        className={`text-[10px] font-bold px-1 uppercase tracking-widest ${active ? "text-primary" : "text-on-surface-variant/60"}`}
      >
        {label}
      </span>
    </button>
  );
}

function ColorFilter({ color, label, active = false, onClick }: any) {
  return (
    <button onClick={onClick} className="shrink-0 w-16 flex flex-col items-center gap-2 group">
      <div
        className={`w-12 h-12 rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-110 ${color} ${active ? "ring-4 ring-primary/30 scale-110" : ""}`}
      />
      <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest">
        {label}
      </span>
    </button>
  );
}
