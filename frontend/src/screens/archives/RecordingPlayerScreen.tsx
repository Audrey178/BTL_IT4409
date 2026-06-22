import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Clock,
  CalendarDays,
  User,
  Users,
  MessageSquare,
  Loader2,
  AlertCircle,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import SideBar from "@/components/layout/SideBar";
import { ChatBubble } from "@/components/pages/archives/ChatBubble";
import { formatDuration, formatDate, formatTime } from "@/utils/dateFormat";
import { recordingService, type Recording } from "@/services/recordingService";
import {
  roomMembersService,
  type RoomParticipant,
} from "@/services/recordingService";
import { chatService, type ChatMessage } from "@/services/chatService";

function formatParticipantDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function RecordingPlayerScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch recording
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await recordingService.getRecording(id);
        if (!cancelled && res.recording) {
          setRecording(res.recording);
        } else if (!cancelled) {
          setError("Không tìm thấy bản ghi");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Lỗi khi tải bản ghi");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id]);

  // Fetch chat history when recording loads
  useEffect(() => {
    const roomCode = recording?.room?.room_code;
    if (!roomCode) return;
    let cancelled = false;

    const loadChat = async () => {
      setChatLoading(true);
      setChatError(null);
      try {
        const res = await chatService.getChatHistory(roomCode, { limit: 100 });
        if (!cancelled) {
          setMessages(res.messages || []);
        }
      } catch (err: any) {
        console.error("Failed to load chat history:", err);
        if (!cancelled) {
          const detail = err.response?.data?.message || err.message || "Lịch sử chat không khả dụng";
          setChatError(`Lịch sử chat không khả dụng: ${detail}`);
        }
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    };

    loadChat();
    return () => { cancelled = true; };
  }, [recording?.room?.room_code]);

  // Fetch participants when recording loads
  useEffect(() => {
    const roomCode = recording?.room?.room_code;
    if (!roomCode) return;
    let cancelled = false;

    const loadParticipants = async () => {
      setParticipantsLoading(true);
      try {
        const res = await roomMembersService.getRoomMembersHistory(roomCode);
        if (!cancelled) {
          setParticipants(res.participants || []);
        }
      } catch {
        // Silently fail — participants section just won't show data
        if (!cancelled) setParticipants([]);
      } finally {
        if (!cancelled) setParticipantsLoading(false);
      }
    };

    loadParticipants();
    return () => { cancelled = true; };
  }, [recording?.room?.room_code]);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <SideBar />
        <main className="ml-64 flex-1 flex items-center justify-center bg-surface">
          <Loader2 size={40} className="text-primary animate-spin" />
        </main>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="flex min-h-screen">
        <SideBar />
        <main className="ml-64 flex-1 flex flex-col items-center justify-center bg-surface gap-4">
          <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center">
            <AlertCircle size={40} className="text-error/40" />
          </div>
          <p className="font-bold text-on-surface text-lg">{error || "Không tìm thấy bản ghi"}</p>
          <Button
            onClick={() => navigate("/archives")}
            variant="outline"
            className="rounded-full px-6 font-bold"
          >
            <ArrowLeft size={16} className="mr-2" />
            Quay lại Lưu trữ
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <SideBar />

      <main className="ml-64 flex-1 flex flex-col bg-surface min-h-screen">
        {/* Top bar */}
        <div className="px-8 py-5 border-b border-outline-variant/10 flex items-center gap-4 shrink-0">
          <Button
            onClick={() => navigate("/archives")}
            variant="ghost"
            size="sm"
            className="rounded-full"
          >
            <ArrowLeft size={18} />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-on-surface truncate">
              {recording.title || "Bản ghi không tên"}
            </h1>
            <div className="flex items-center gap-4 text-xs text-on-surface-variant/60 mt-0.5">
              {recording.room?.room_code && (
                <span className="font-mono font-bold bg-surface-container px-2 py-0.5 rounded">
                  {recording.room.room_code}
                </span>
              )}
              <span className="flex items-center gap-1">
                <CalendarDays size={12} />
                {formatDate(recording.recorded_at)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDuration(recording.duration_seconds)}
              </span>
              {recording.owner && (
                <span className="flex items-center gap-1">
                  <User size={12} />
                  {recording.owner.full_name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content: Video + Chat (fixed viewport height) */}
        <div className="flex h-[calc(100vh-82px)] shrink-0">
          {/* Video Player */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col p-6 min-w-0"
          >
            <div className="flex-1 relative rounded-2xl overflow-hidden bg-stone-900 shadow-lg">
              <video
                ref={videoRef}
                src={recording.file_url}
                controls
                className="w-full h-full object-contain bg-black"
                controlsList="nodownload"
              >
                Your browser does not support the video element.
              </video>
            </div>

            {/* Recording description */}
            {recording.description && (
              <div className="mt-4 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                <p className="text-sm text-on-surface-variant">{recording.description}</p>
              </div>
            )}
          </motion.div>

          {/* Chat History Panel */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="w-[380px] border-l border-outline-variant/10 flex flex-col shrink-0 bg-surface-container-lowest"
          >
            <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-2">
              <MessageSquare size={18} className="text-primary" />
              <h2 className="font-bold text-on-surface text-sm">Lịch sử chat</h2>
              {messages.length > 0 && (
                <span className="text-xs text-on-surface-variant/50 ml-auto">
                  {messages.length} tin nhắn
                </span>
              )}
            </div>

            {chatLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={24} className="text-primary animate-spin" />
              </div>
            ) : chatError ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6">
                <MessageSquare size={32} className="text-on-surface-variant/20" />
                <p className="text-sm text-on-surface-variant/50 text-center">{chatError}</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6">
                <MessageSquare size={32} className="text-on-surface-variant/20" />
                <p className="text-sm text-on-surface-variant/50 text-center">
                  Không có tin nhắn nào cho cuộc họp này.
                </p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {messages.map((msg) => (
                    <ChatBubble key={msg._id} message={msg} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </motion.div>
        </div>

        {/* Participants Section — below the entire video+chat area */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="px-6 py-5 border-t border-outline-variant/10"
        >
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-primary" />
            <h2 className="font-bold text-on-surface text-sm">Người tham gia</h2>
            {participants.length > 0 && (
              <span className="text-xs text-on-surface-variant/50 bg-surface-container px-2 py-0.5 rounded-full font-semibold">
                {participants.length}
              </span>
            )}
          </div>

          {participantsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="text-primary animate-spin" />
            </div>
          ) : participants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Users size={32} className="text-on-surface-variant/20" />
              <p className="text-sm text-on-surface-variant/50 text-center">
                Không có dữ liệu người tham gia.
              </p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {participants.map((p) => (
                <ParticipantCard key={p.id} participant={p} />
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function ParticipantCard({ participant }: { participant: RoomParticipant }) {
  const initials = participant.fullName
    ? participant.fullName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="min-w-[200px] max-w-[220px] shrink-0 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 flex flex-col gap-3 hover:border-primary/20 transition-colors">
      {/* Avatar + Name */}
      <div className="flex items-center gap-3">
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-on-surface truncate">
            {participant.fullName || "Unknown"}
          </p>
          {participant.email && (
            <p className="text-[11px] text-on-surface-variant/50 truncate flex items-center gap-1">
              <Mail size={10} className="shrink-0" />
              {participant.email}
            </p>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="space-y-1.5">
        {participant.joinedAt && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-on-surface-variant/50">Tham gia</span>
            <span className="text-on-surface-variant font-medium">
              {formatTime(participant.joinedAt)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-on-surface-variant/50">Thời lượng</span>
          <span className="text-on-surface-variant font-medium">
            {formatParticipantDuration(participant.duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
