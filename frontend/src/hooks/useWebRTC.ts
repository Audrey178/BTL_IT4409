import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/socket/socket';
import { WEBRTC_EVENTS, ROOM_EVENTS } from '@/socket/events';
import { useMediaStore } from '@/stores/mediaStore';
import { useMeetingStore } from '@/stores/meetingStore';
import { useAuthStore } from '@/stores/useAuthStore';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWebRTC(roomCode: string | null) {
  const socket = getSocket();
  const { localStream } = useMediaStore();
  const { addParticipant, updateParticipantStream, participants, removeParticipant } = useMeetingStore();
  const myUserId = useAuthStore((s) => s.user?._id);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const outgoingTrackRef = useRef<MediaStreamTrack | null>(null);

  const createPeer = useCallback((userId: string, isInitiator: boolean) => {
    // Nếu đã có peer cho user này, close cũ trước
    const existingPeer = peersRef.current.get(userId);
    if (existingPeer) {
      existingPeer.close();
      peersRef.current.delete(userId);
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current.set(userId, peer);

    if (localStream) {
      // If there's an overridden outgoing video track (canvas pipeline), add it instead of the raw local video track
      const outVideoTrack = outgoingTrackRef.current;
      localStream.getTracks().forEach(track => {
        if (track.kind === 'video' && outVideoTrack) {
          const outStream = new MediaStream([outVideoTrack]);
          peer.addTrack(outVideoTrack, outStream);
        } else {
          peer.addTrack(track, localStream);
        }
      });
    }

    peer.ontrack = (event) => {
      const remoteStream = event.streams[0];
      updateParticipantStream(userId, remoteStream);
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit(WEBRTC_EVENTS.ICE_CANDIDATE, {
          to: userId,
          candidate: event.candidate,
        });
      }
    };

    if (isInitiator) {
      peer.createOffer().then(offer => {
        return peer.setLocalDescription(offer);
      }).then(() => {
        socket.emit(WEBRTC_EVENTS.OFFER, {
          to: userId,
          offer: peer.localDescription,
        });
      });
    }

    return peer;
  }, [localStream, socket, updateParticipantStream]);

  const replaceOutgoingTrack = useCallback((newTrack: MediaStreamTrack | null) => {
    outgoingTrackRef.current = newTrack;
    peersRef.current.forEach((peer) => {
      try {
        const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
        const fallbackTrack = localStream?.getVideoTracks()?.[0] ?? null;

        if (sender) {
          if (newTrack) {
            sender.replaceTrack(newTrack);
          } else {
            sender.replaceTrack(fallbackTrack);
          }
          return;
        }

        // If no sender exists (e.g. peer was created before camera track was ready), add one now.
        const trackToAdd = newTrack ?? fallbackTrack;
        if (trackToAdd) {
          peer.addTrack(trackToAdd, new MediaStream([trackToAdd]));
        }
      } catch (err) {
        console.error('Error replacing outgoing track for peer', err);
      }
    });
  }, [localStream]);

  useEffect(() => {
    if (!roomCode || !myUserId) return;

    participants.forEach(p => {
      if (p.id !== myUserId && !peersRef.current.has(p.id)) {
        // Dùng tie-breaker để quyết định ai là initiator tránh WebRTC glare
        const isInitiator = myUserId < p.id;
        createPeer(p.id, isInitiator);
      }
    });
  }, [participants, myUserId, roomCode, createPeer]); // Effect này sẽ chạy khi component mount và khi participants thay đổi

  useEffect(() => {
    if (!roomCode || !myUserId) return;

    const handleUserJoined = (data: {
      userId?: string;
      isSelf?: boolean;
    }) => {
      if (data.isSelf) return; // LobbyScreen handling

      const uId = data.userId;
      if (!uId || uId === myUserId) return;

      if (!peersRef.current.has(uId)) {
        const isInitiator = myUserId < uId;
        createPeer(uId, isInitiator);
      }
    };

    const handleUserLeft = (data: { userId?: string }) => {
      const uId = data.userId;
      if (!uId) return;
      const peer = peersRef.current.get(uId);
      if (peer) {
        peer.close();
        peersRef.current.delete(uId);
      }
    };

    const handleOffer = async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      if (from === myUserId) return;

      addParticipant({
        id: from,
        fullName: 'Participant', // Fallback, useRoomEvents sẽ update full_name nếu cần
        isActive: true,
        isAudioMuted: false,
        isVideoMuted: false,
      });

      let peer = peersRef.current.get(from);
      if (!peer) {
        peer = createPeer(from, false);
      }
      
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit(WEBRTC_EVENTS.ANSWER, {
          to: from,
          answer: peer.localDescription,
        });
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    };

    const handleAnswer = async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      const peer = peersRef.current.get(from);
      if (peer) {
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error("Error setting remote description from answer:", err);
        }
      }
    };

    const handleIceCandidate = async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const peer = peersRef.current.get(from);
      if (peer) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          // ICE candidate errors are non-fatal
        }
      }
    };

    socket.on(ROOM_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(ROOM_EVENTS.USER_LEFT, handleUserLeft);
    socket.on(WEBRTC_EVENTS.OFFER, handleOffer);
    socket.on(WEBRTC_EVENTS.ANSWER, handleAnswer);
    socket.on(WEBRTC_EVENTS.ICE_CANDIDATE, handleIceCandidate);

    return () => {
      socket.off(ROOM_EVENTS.USER_JOINED, handleUserJoined);
      socket.off(ROOM_EVENTS.USER_LEFT, handleUserLeft);
      socket.off(WEBRTC_EVENTS.OFFER, handleOffer);
      socket.off(WEBRTC_EVENTS.ANSWER, handleAnswer);
      socket.off(WEBRTC_EVENTS.ICE_CANDIDATE, handleIceCandidate);
    };
  }, [socket, createPeer, addParticipant, removeParticipant, roomCode, myUserId]);

  const cleanupAllPeers = useCallback(() => {
    peersRef.current.forEach(peer => peer.close());
    peersRef.current.clear();
  }, []);

  // Clean up all peers on unmount
  useEffect(() => {
    return () => {
      cleanupAllPeers();
    };
  }, [cleanupAllPeers]);

  return {
    replaceVideoTrack: replaceOutgoingTrack,
    replaceOutgoingTrack,
    cleanupAllPeers,
  };
}
