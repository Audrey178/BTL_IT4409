import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/socket/socket';
import { WEBRTC_EVENTS, ROOM_EVENTS } from '@/socket/events';
import { useMediaStore } from '@/stores/mediaStore';
import { useMeetingStore } from '@/stores/meetingStore';
import { useAuthStore } from '@/stores/useAuthStore';

// TypeScript types for WebRTC events
interface UserJoinedData {
  userId: string;
  user?: {
    _id: string;
    full_name: string;
    fullName: string;
  };
}

interface UserLeftData {
  userId: string;
  user?: {
    _id: string;
  };
}

interface WebRTCOfferData {
  from: string;
  offer: RTCSessionDescriptionInit;
}

interface WebRTCAnswerData {
  from: string;
  answer: RTCSessionDescriptionInit;
}

interface ICECandidateData {
  from: string;
  candidate: RTCIceCandidateInit;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWebRTC(roomCode: string | null) {
  const socket = getSocket();
  const { localStream } = useMediaStore();
  const { addParticipant, removeParticipant, updateParticipantStream } = useMeetingStore();
  const currentUserId = useAuthStore((state) => state.user?._id);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const outgoingTrackRef = useRef<MediaStreamTrack | null>(null);

  const createPeer = useCallback((userId: string, isInitiator: boolean) => {
    const existingPeer = peersRef.current.get(userId);
    if (existingPeer) {
      return existingPeer;
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
      // Delay to ensure the receiver is ready, though normally trickle ICE works
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
          offer: peer.localDescription
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
        if (sender) {
          if (newTrack) {
            sender.replaceTrack(newTrack);
          } else if (localStream && localStream.getVideoTracks().length) {
            sender.replaceTrack(localStream.getVideoTracks()[0]);
          }
        }
      } catch (err) {
        console.error('Error replacing outgoing track for peer', err);
      }
    });
  }, [localStream]);

  useEffect(() => {
    if (!roomCode) return;

    const handleUserJoined = (data: UserJoinedData) => {
      const uId = data.userId || data.user?._id;
      if (!uId || uId === currentUserId) return;
      addParticipant({ 
        id: uId, 
        fullName: data.user?.full_name || data.user?.fullName || 'Guest', 
        isActive: true, 
        isAudioMuted: false, 
        isVideoMuted: false 
      });
      createPeer(uId, true); // I am already here, I initiate offer to latecomer
    };

    const handleUserLeft = (data: UserLeftData) => {
      const uId = data.userId || data.user?._id;
      if (!uId) return;
      removeParticipant(uId);
      const peer = peersRef.current.get(uId);
      if (peer) {
        peer.close();
        peersRef.current.delete(uId);
      }
    };

    const handleOffer = async (data: WebRTCOfferData) => {
      const { from, offer } = data;
      if (!from) return;
      const peer = createPeer(from, false);
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit(WEBRTC_EVENTS.ANSWER, {
          to: from,
          answer: peer.localDescription
        });
      } catch (error) {
        console.error('Error handling WebRTC offer:', error);
      }
    };

    const handleAnswer = async (data: WebRTCAnswerData) => {
      const { from, answer } = data;
      if (!from) return;
      const peer = peersRef.current.get(from);
      if (peer) {
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error('Error handling WebRTC answer:', error);
        }
      }
    };

    const handleIceCandidate = async (data: ICECandidateData) => {
      const { from, candidate } = data;
      if (!from) return;
      const peer = peersRef.current.get(from);
      if (peer) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
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
  }, [socket, createPeer, addParticipant, removeParticipant, roomCode, currentUserId]);

  // Clean up all peers on unmount
  useEffect(() => {
    return () => {
      peersRef.current.forEach(peer => peer.close());
      peersRef.current.clear();
    };
  }, []);

  return { replaceOutgoingTrack };
}
