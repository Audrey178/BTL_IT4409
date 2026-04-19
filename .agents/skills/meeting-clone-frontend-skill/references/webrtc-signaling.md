# WebRTC + Socket.IO Signaling Reference

## Signaling Flow Diagram

```
New User (B) joins room where User A already exists
─────────────────────────────────────────────────────────────
B                        Server                      A
|                           |                        |
|── room:join ─────────────>|                        |
|                           |── room:user_joined ──>|
|                           |   { userId: B }        |
|                           |                        |
|  [A creates PeerConn for B, gets local stream]     |
|                           |<── webrtc:offer ───────|
|                           |   { to: B, sdp }       |
|<── webrtc:offer ──────────|                        |
|                           |                        |
|  [B creates PeerConn for A, sets remoteDesc]       |
|── webrtc:answer ─────────>|                        |
|                           |── webrtc:answer ──────>|
|                           |                        |
|<══ webrtc:ice_candidate ══════════════════════════>|
|    (bidirectional, continuous)                     |
```

## useWebRTC Hook Implementation

```tsx
// hooks/useWebRTC.ts
import { useEffect, useRef, useCallback } from 'react'
import { getSocket } from '@/socket/socket'
import { WEBRTC_EVENTS, ROOM_EVENTS } from '@/socket/events'
import { useMeetingStore } from '@/stores/meetingStore'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
}

export function useWebRTC(localStream: MediaStream | null) {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
  const { addParticipant, removeParticipant } = useMeetingStore()
  const socket = getSocket()

  const createPeerConnection = useCallback((remoteUserId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS)

    // Add local tracks to the connection
    localStream?.getTracks().forEach(track => {
      pc.addTrack(track, localStream)
    })

    // When remote track arrives, update participant's stream
    pc.ontrack = (event) => {
      addParticipant({
        userId: remoteUserId,
        stream: event.streams[0]
      })
    }

    // Forward ICE candidates to the remote peer via server
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit(WEBRTC_EVENTS.ICE_CANDIDATE, {
          to: remoteUserId,
          candidate: event.candidate
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        peerConnections.current.delete(remoteUserId)
        removeParticipant(remoteUserId)
      }
    }

    peerConnections.current.set(remoteUserId, pc)
    return pc
  }, [localStream, socket, addParticipant, removeParticipant])

  useEffect(() => {
    if (!localStream) return

    // Existing participant: someone new joined → I must initiate offer
    const handleUserJoined = async ({ userId }: { userId: string }) => {
      const pc = createPeerConnection(userId)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit(WEBRTC_EVENTS.OFFER, { to: userId, sdp: offer })
    }

    // I am the new joiner: receive offer from existing participant
    const handleOffer = async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = createPeerConnection(from)
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit(WEBRTC_EVENTS.ANSWER, { to: from, sdp: answer })
    }

    const handleAnswer = async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current.get(from)
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    }

    const handleIceCandidate = async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current.get(from)
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate))
    }

    const handleUserLeft = ({ userId }: { userId: string }) => {
      const pc = peerConnections.current.get(userId)
      pc?.close()
      peerConnections.current.delete(userId)
      removeParticipant(userId)
    }

    socket.on(ROOM_EVENTS.USER_JOINED, handleUserJoined)
    socket.on(WEBRTC_EVENTS.OFFER, handleOffer)
    socket.on(WEBRTC_EVENTS.ANSWER, handleAnswer)
    socket.on(WEBRTC_EVENTS.ICE_CANDIDATE, handleIceCandidate)
    socket.on(ROOM_EVENTS.USER_LEFT, handleUserLeft)

    return () => {
      socket.off(ROOM_EVENTS.USER_JOINED, handleUserJoined)
      socket.off(WEBRTC_EVENTS.OFFER, handleOffer)
      socket.off(WEBRTC_EVENTS.ANSWER, handleAnswer)
      socket.off(WEBRTC_EVENTS.ICE_CANDIDATE, handleIceCandidate)
      socket.off(ROOM_EVENTS.USER_LEFT, handleUserLeft)
      // Cleanup all peer connections
      peerConnections.current.forEach(pc => pc.close())
      peerConnections.current.clear()
    }
  }, [localStream, socket, createPeerConnection, removeParticipant])

  const closePeerConnection = useCallback((userId: string) => {
    const pc = peerConnections.current.get(userId)
    pc?.close()
    peerConnections.current.delete(userId)
  }, [])

  return { closePeerConnection }
}
```

## useMedia Hook (Camera / Mic)

```tsx
// hooks/useMedia.ts
import { useState, useEffect, useRef } from 'react'

export function useMedia() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isCamOn, setIsCamOn] = useState(true)
  const [isMicOn, setIsMicOn] = useState(true)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(stream => {
        streamRef.current = stream
        setLocalStream(stream)
      })
      .catch(console.error)

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const toggleCam = () => {
    localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setIsCamOn(prev => !prev)
  }

  const toggleMic = () => {
    localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMicOn(prev => !prev)
  }

  return { localStream, isCamOn, isMicOn, toggleCam, toggleMic }
}
```

## Host Controls — Kick & Force Disconnect

```tsx
// On host's side
socket.emit(ROOM_EVENTS.KICK_USER, { targetUserId })

// All clients listen for this:
socket.on(ROOM_EVENTS.FORCE_DISCONNECT, () => {
  navigate('/dashboard', { replace: true })
})
```

## Room End Flow

When host calls `PUT /api/v1/rooms/:roomCode/end`, the backend:
1. Updates MongoDB room status to `ended`
2. Emits `room:force_disconnect` to all sockets in the room
3. Cleans Redis state

Frontend must handle `room:force_disconnect` at the top of `MeetingPage`:
```tsx
useEffect(() => {
  socket.on(ROOM_EVENTS.FORCE_DISCONNECT, () => {
    cleanupMeeting()        // stop streams, close peer connections
    meetingStore.reset()
    navigate('/dashboard')
  })
  return () => { socket.off(ROOM_EVENTS.FORCE_DISCONNECT) }
}, [])
```
