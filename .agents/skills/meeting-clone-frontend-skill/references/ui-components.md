# Architecture & UI Components Reference

## Application State Architecture

```
                    ┌─────────────────────────────────────┐
                    │           MeetingPage.tsx            │
                    │  (orchestrates all hooks & panels)   │
                    └──────┬──────────────┬───────────────┘
                           │              │
              ┌────────────▼───┐    ┌─────▼──────────┐
              │  useMedia()    │    │  useWebRTC()   │
              │  (camera/mic)  │    │  (peer conns)  │
              └────────────────┘    └────────────────┘
                           │              │
              ┌────────────▼──────────────▼───────────┐
              │         meetingStore (Zustand)          │
              │  participants | messages | waitingList  │
              │  roomCode | hostId | status             │
              └───────────────────────────────────────┘
                           │
              ┌────────────▼──────────────────────────┐
              │         Socket Singleton               │
              │    emits events ↔ updates store        │
              └───────────────────────────────────────┘
```

---

## MeetingPage Structure

```tsx
// pages/MeetingPage.tsx  (simplified)
export default function MeetingPage() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const { localStream, isCamOn, isMicOn, toggleCam, toggleMic } = useMedia()
  const { closePeerConnection } = useWebRTC(localStream)
  const participants = useMeetingStore(s => s.participants)
  const isHost = useMeetingStore(s => s.hostId === useAuthStore.getState().user?._id)
  const socket = getSocket()

  // Join room on mount
  useEffect(() => {
    socket.emit(ROOM_EVENTS.JOIN, { roomCode })
    return () => {
      socket.emit('room:leave', { roomCode })
      localStream?.getTracks().forEach(t => t.stop())
    }
  }, [roomCode])

  return (
    <div className="h-screen bg-zinc-950 flex flex-col">
      <VideoGrid participants={participants} localStream={localStream} />
      <ControlBar
        isCamOn={isCamOn} isMicOn={isMicOn}
        onToggleCam={toggleCam} onToggleMic={toggleMic}
        isHost={isHost} roomCode={roomCode!}
      />
      {/* Panels shown via state toggles */}
      <ChatPanel />
      {isHost && <WaitingRoomPanel />}
    </div>
  )
}
```

---

## VideoGrid Component

```tsx
// components/meeting/VideoGrid.tsx
interface VideoGridProps {
  participants: Participant[]
  localStream: MediaStream | null
}

export function VideoGrid({ participants, localStream }: VideoGridProps) {
  const total = participants.length + 1  // +1 for local

  const gridClass = clsx(
    'grid flex-1 gap-2 p-4',
    total === 1 && 'grid-cols-1',
    total === 2 && 'grid-cols-2',
    total <= 4 && 'grid-cols-2',
    total <= 9 && 'grid-cols-3',
    total > 9 && 'grid-cols-4'
  )

  return (
    <div className={gridClass}>
      <VideoTile stream={localStream} label="Bạn" isLocal />
      {participants.map(p => (
        <VideoTile key={p.userId} stream={p.stream} label={p.user?.full_name ?? p.userId} />
      ))}
    </div>
  )
}
```

## VideoTile Component

```tsx
// components/meeting/VideoTile.tsx
interface VideoTileProps {
  stream?: MediaStream | null
  label: string
  isLocal?: boolean
}

export function VideoTile({ stream, label, isLocal }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className="relative aspect-video bg-zinc-900 rounded-xl overflow-hidden">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <Avatar className="w-16 h-16">
            <AvatarFallback>{label[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
      )}
      <span className="absolute bottom-2 left-2 text-xs text-white bg-black/40 rounded px-2 py-0.5">
        {label}
      </span>
    </div>
  )
}
```

---

## ControlBar Component

```tsx
// components/meeting/ControlBar.tsx
export function ControlBar({ isCamOn, isMicOn, onToggleCam, onToggleMic, isHost, roomCode }) {
  const navigate = useNavigate()
  const [showChat, setShowChat] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)

  const handleLeave = () => {
    disconnectSocket()
    navigate('/dashboard')
  }

  const handleEndMeeting = async () => {
    await roomApi.endRoom(roomCode)
    // server will emit room:force_disconnect to all
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-900/90 backdrop-blur border-t border-zinc-800 flex items-center justify-center gap-3 px-4">
      <Tooltip content={isMicOn ? 'Tắt mic' : 'Bật mic'}>
        <Button variant={isMicOn ? 'secondary' : 'destructive'} size="icon" onClick={onToggleMic}>
          {isMicOn ? <Mic /> : <MicOff />}
        </Button>
      </Tooltip>
      <Tooltip content={isCamOn ? 'Tắt camera' : 'Bật camera'}>
        <Button variant={isCamOn ? 'secondary' : 'destructive'} size="icon" onClick={onToggleCam}>
          {isCamOn ? <Video /> : <VideoOff />}
        </Button>
      </Tooltip>
      <Button variant="ghost" size="icon" onClick={() => setShowChat(p => !p)}>
        <MessageSquare />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => setShowParticipants(p => !p)}>
        <Users />
      </Button>
      {isHost && (
        <Button variant="destructive" onClick={handleEndMeeting}>
          Kết thúc
        </Button>
      )}
      {!isHost && (
        <Button variant="outline" onClick={handleLeave}>
          Rời phòng
        </Button>
      )}
    </div>
  )
}
```

---

## ChatPanel (with history + realtime)

```tsx
// components/meeting/ChatPanel.tsx
export function ChatPanel({ roomCode }: { roomCode: string }) {
  const messages = useMeetingStore(s => s.messages)
  const addMessage = useMeetingStore(s => s.addMessage)
  const socket = getSocket()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { register, handleSubmit, reset } = useForm<{ content: string }>()

  // Load history on mount
  const { data } = useQuery({
    queryKey: ['messages', roomCode],
    queryFn: () => api.get(`/api/v1/history/rooms/${roomCode}/messages`).then(r => r.data.messages)
  })

  useEffect(() => {
    if (data) data.forEach(addMessage)
  }, [data])

  // Realtime receive
  useEffect(() => {
    socket.on(CHAT_EVENTS.RECEIVE, addMessage)
    socket.on(CHAT_EVENTS.SYSTEM_ALERT, (msg: { message: string }) => {
      addMessage({ type: 'system', content: msg.message, timestamp: new Date().toISOString(), _id: Date.now().toString() } as any)
    })
    return () => {
      socket.off(CHAT_EVENTS.RECEIVE)
      socket.off(CHAT_EVENTS.SYSTEM_ALERT)
    }
  }, [socket, addMessage])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const onSend = ({ content }: { content: string }) => {
    socket.emit(CHAT_EVENTS.SEND, { roomCode, content })
    reset()
  }

  return (
    <div className="w-80 flex flex-col h-full border-l border-zinc-800 bg-zinc-950">
      <ScrollArea ref={scrollRef} className="flex-1 p-3">
        {messages.map(msg => (
          <div key={msg._id} className={clsx('mb-2', msg.type === 'system' && 'text-center text-xs text-zinc-400')}>
            {msg.type === 'system' ? (
              <span>{msg.content}</span>
            ) : (
              <>
                <span className="font-medium text-sm">{msg.sender_name}: </span>
                <span className="text-sm text-zinc-300">{msg.content}</span>
              </>
            )}
          </div>
        ))}
      </ScrollArea>
      <form onSubmit={handleSubmit(onSend)} className="p-3 flex gap-2">
        <Input {...register('content', { required: true })} placeholder="Nhắn tin..." />
        <Button type="submit" size="icon"><Send className="w-4 h-4" /></Button>
      </form>
    </div>
  )
}
```

---

## WaitingRoom Panel (Host only)

```tsx
// components/meeting/WaitingRoomPanel.tsx
export function WaitingRoomPanel() {
  const waitingList = useMeetingStore(s => s.waitingList)
  const socket = getSocket()

  const approve = (userId: string) => socket.emit(ROOM_EVENTS.APPROVE_USER, { userId })
  const reject = (userId: string) => socket.emit(ROOM_EVENTS.REJECT_USER, { userId })

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          Phòng chờ {waitingList.length > 0 && <Badge>{waitingList.length}</Badge>}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <h3 className="font-semibold mb-4">Đang chờ vào phòng</h3>
        {waitingList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có ai đang chờ</p>
        ) : (
          waitingList.map(u => (
            <div key={u.userId} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Avatar><AvatarFallback>{u.full_name[0]}</AvatarFallback></Avatar>
                <span className="text-sm">{u.full_name}</span>
              </div>
              <div className="flex gap-1">
                <Button size="sm" onClick={() => approve(u.userId)}>Cho vào</Button>
                <Button size="sm" variant="outline" onClick={() => reject(u.userId)}>Từ chối</Button>
              </div>
            </div>
          ))
        )}
      </SheetContent>
    </Sheet>
  )
}
```

---

## Router Setup

```tsx
// router.tsx
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuthStore } from '@/stores/authStore'

const LoginPage     = lazy(() => import('@/pages/LoginPage'))
const RegisterPage  = lazy(() => import('@/pages/RegisterPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const MeetingPage   = lazy(() => import('@/pages/MeetingPage'))
const HistoryPage   = lazy(() => import('@/pages/HistoryPage'))

const ProtectedRoute = () => {
  const token = useAuthStore(s => s.accessToken)
  return token ? <Outlet /> : <Navigate to="/login" replace />
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/meeting/:roomCode', element: <MeetingPage /> },
      { path: '/history', element: <HistoryPage /> },
    ]
  }
])
```
