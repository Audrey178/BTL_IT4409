import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/socket/socket';
import { WEBRTC_EVENTS, ROOM_EVENTS } from '@/socket/events';
import { useMediaStore } from '@/stores/mediaStore';
import { useMeetingStore } from '@/stores/meetingStore';

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
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const createPeer = useCallback((userId: string, isInitiator: boolean) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current.set(userId, peer);

    if (localStream) {
      localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
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

  useEffect(() => {
    if (!roomCode) return;

    const handleUserJoined = (data: any) => {
      const uId = data.userId || data.user?._id;
      if (!uId) return;
      addParticipant({ id: uId, fullName: data.user?.fullName || data.user?.full_name || 'Guest', isActive: true, isAudioMuted: false, isVideoMuted: false });
      createPeer(uId, true); // I am already here, I initiate offer to latecomer
    };

    const handleUserLeft = (data: any) => {
      const uId = data.userId || data.user?._id;
      if (!uId) return;
      removeParticipant(uId);
      const peer = peersRef.current.get(uId);
      if (peer) {
        peer.close();
        peersRef.current.delete(uId);
      }
    };

    const handleOffer = async ({ from, offer }: any) => {
      const peer = createPeer(from, false);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit(WEBRTC_EVENTS.ANSWER, {
        to: from,
        answer: peer.localDescription
      });
    };

    const handleAnswer = async ({ from, answer }: any) => {
      const peer = peersRef.current.get(from);
      if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleIceCandidate = async ({ from, candidate }: any) => {
      const peer = peersRef.current.get(from);
      if (peer) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
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
  }, [socket, createPeer, addParticipant, removeParticipant, roomCode]);

  // Clean up all peers on unmount
  useEffect(() => {
    return () => {
      peersRef.current.forEach(peer => peer.close());
      peersRef.current.clear();
    };
  }, []);

  return null;
}
