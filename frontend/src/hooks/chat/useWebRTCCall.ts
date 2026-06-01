import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState, LocalParticipant, RemoteParticipant, Room, RoomEvent, Track } from "livekit-client";
import { CALL_EVENTS } from "@/socket/events";
import { livekitService } from "@/services/livekitService";
import { connectSocket, getSocket } from "@/socket/socket";
import { useMessageStore, type CallSessionState } from "@/stores/messageStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "sonner";

type CallType = "audio" | "video";

export interface ConversationCallParticipant {
  userId: string;
  name: string;
  stream: MediaStream | null;
  hasVideo: boolean;
}

const buildLocalStream = (participant: LocalParticipant) => {
  const stream = new MediaStream();
  participant.trackPublications.forEach((publication) => {
    const track = publication.track;
    if (!track || publication.source === Track.Source.ScreenShare) {
      return;
    }
    stream.addTrack(track.mediaStreamTrack);
  });
  return stream.getTracks().length > 0 ? stream : null;
};

const buildParticipantStream = (participant: RemoteParticipant) => {
  const stream = new MediaStream();
  participant.trackPublications.forEach((publication) => {
    const track = publication.track;
    if (!track || publication.source === Track.Source.ScreenShare) {
      return;
    }
    stream.addTrack(track.mediaStreamTrack);
  });
  return stream.getTracks().length > 0 ? stream : null;
};

const getRemoteParticipants = (room: Room): ConversationCallParticipant[] =>
  [...room.remoteParticipants.values()].map((participant) => ({
    userId: participant.identity,
    name: participant.name || participant.identity,
    stream: buildParticipantStream(participant),
    hasVideo: participant.getTrackPublication(Track.Source.Camera)?.isSubscribed || false,
  }));

export function useWebRTCCall(conversationId: string | null) {
  const activeCall = useMessageStore((state) => state.activeCall);
  const setActiveCall = useMessageStore((state) => state.setActiveCall);
  const authUser = useAuthStore((state) => state.user);
  const myUserId = authUser?._id || null;

  const activeCallRef = useRef<CallSessionState | null>(null);
  const roomRef = useRef<Room | null>(null);
  const joinedCallIdRef = useRef<string | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<ConversationCallParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const teardownRoom = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      room.disconnect();
    }
    roomRef.current = null;
    joinedCallIdRef.current = null;
    setLocalStream(null);
    setRemoteParticipants([]);
    setIsMicEnabled(true);
    setIsCameraEnabled(false);
  }, []);

  const joinCallRoom = useCallback(async (callId: string, callType: CallType) => {
    if (joinedCallIdRef.current === callId && roomRef.current) {
      return roomRef.current;
    }

    teardownRoom();

    const { token, url } = await livekitService.getCallToken(callId);
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: { width: 1280, height: 720, frameRate: 24 },
      },
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const syncRemoteParticipants = () => {
      setRemoteParticipants(getRemoteParticipants(room));
    };

    const syncLocalParticipant = () => {
      setLocalStream(buildLocalStream(room.localParticipant));
      setIsMicEnabled(room.localParticipant.isMicrophoneEnabled);
      setIsCameraEnabled(room.localParticipant.isCameraEnabled);
    };

    room.on(RoomEvent.ParticipantConnected, syncRemoteParticipants);
    room.on(RoomEvent.ParticipantDisconnected, syncRemoteParticipants);
    room.on(RoomEvent.TrackSubscribed, syncRemoteParticipants);
    room.on(RoomEvent.TrackUnsubscribed, syncRemoteParticipants);
    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (state === ConnectionState.Disconnected) {
        joinedCallIdRef.current = null;
      }
    });
    room.on(RoomEvent.LocalTrackPublished, syncLocalParticipant);
    room.on(RoomEvent.LocalTrackUnpublished, syncLocalParticipant);

    await room.connect(url, token);
    roomRef.current = room;
    joinedCallIdRef.current = callId;

    await room.localParticipant.setMicrophoneEnabled(true);
    await room.localParticipant.setCameraEnabled(callType === "video");

    syncLocalParticipant();
    syncRemoteParticipants();
    return room;
  }, [teardownRoom]);

  useEffect(() => {
    const socket = getSocket();

    const handleRinging = (payload: {
      callId: string;
      roomCode: string | null;
      conversationId: string | null;
      callerId: string;
      callerName: string;
      targetUserIds: string[];
      callType: CallType;
      startedAt: string;
      direction: "incoming" | "outgoing";
      acceptedUserIds?: string[];
    }) => {
      setActiveCall({
        callId: payload.callId,
        conversationId: payload.conversationId,
        roomCode: payload.roomCode,
        callType: payload.callType,
        direction: payload.direction,
        state: payload.direction === "incoming" ? "ringing-incoming" : "ringing-outgoing",
        callerId: payload.callerId,
        callerName: payload.callerName,
        targetUserIds: payload.targetUserIds,
        startedAt: payload.startedAt,
        acceptedUserIds: payload.acceptedUserIds || [],
      });
      setError(null);
    };

    const handleAccepted = async (payload: {
      callId: string;
      conversationId: string | null;
      roomCode: string | null;
      answeredAt: string | null;
      acceptedUserIds: string[];
      userId: string;
      final: boolean;
    }) => {
      const currentCall = activeCallRef.current;
      if (!currentCall || currentCall.callId !== payload.callId) {
        return;
      }

      const acceptedUserIds = payload.acceptedUserIds || currentCall.acceptedUserIds || [];
      const selfAccepted = Boolean(myUserId && acceptedUserIds.includes(myUserId));
      const shouldJoinAsCaller = currentCall.direction === "outgoing" && acceptedUserIds.length > 0;
      const shouldJoinAsReceiver = currentCall.direction === "incoming" && selfAccepted;

      const nextCall: CallSessionState = {
        ...currentCall,
        answeredAt: payload.answeredAt,
        acceptedUserIds,
        state:
          shouldJoinAsCaller || shouldJoinAsReceiver
            ? roomRef.current
              ? "active"
              : "connecting"
            : currentCall.state,
      };
      setActiveCall(nextCall);

      if ((shouldJoinAsCaller || shouldJoinAsReceiver) && joinedCallIdRef.current !== payload.callId) {
        try {
          await joinCallRoom(payload.callId, currentCall.callType);
          setActiveCall({
            ...nextCall,
            state: "active",
          });
          setError(null);
        } catch (joinError) {
          const message = joinError instanceof Error ? joinError.message : "Failed to join call";
          setError(message);
        }
      }
    };

    const handleRejected = (payload: { callId: string; userId: string; final: boolean }) => {
      const currentCall = activeCallRef.current;
      if (!currentCall || currentCall.callId !== payload.callId) {
        return;
      }

      if (payload.final || (myUserId && payload.userId === myUserId)) {
        teardownRoom();
        setActiveCall({ ...currentCall, state: "rejected" });
      }
    };

    const handleMissed = (payload: { callId: string; durationSeconds?: number }) => {
      const currentCall = activeCallRef.current;
      if (!currentCall || currentCall.callId !== payload.callId) {
        return;
      }
      teardownRoom();
      setActiveCall({ ...currentCall, state: "missed", durationSeconds: payload.durationSeconds || 0 });
    };

    const handleEnded = (payload: {
      callId: string;
      durationSeconds: number;
      final: boolean;
      scope?: "self";
    }) => {
      const currentCall = activeCallRef.current;
      if (!currentCall || currentCall.callId !== payload.callId) {
        return;
      }

      teardownRoom();
      setActiveCall({
        ...currentCall,
        state: "ended",
        durationSeconds: payload.durationSeconds,
      });
    };

    const handleCallError = (payload: { message: string }) => {
      toast.error(payload.message);
      setError(payload.message);
      if (activeCallRef.current?.callId.startsWith("pending-")) {
        setActiveCall(null);
      }
    };

    socket.on(CALL_EVENTS.RINGING, handleRinging);
    socket.on(CALL_EVENTS.ACCEPTED, handleAccepted);
    socket.on(CALL_EVENTS.REJECTED, handleRejected);
    socket.on(CALL_EVENTS.MISSED, handleMissed);
    socket.on(CALL_EVENTS.ENDED, handleEnded);
    socket.on(CALL_EVENTS.ERROR, handleCallError);

    return () => {
      socket.off(CALL_EVENTS.RINGING, handleRinging);
      socket.off(CALL_EVENTS.ACCEPTED, handleAccepted);
      socket.off(CALL_EVENTS.REJECTED, handleRejected);
      socket.off(CALL_EVENTS.MISSED, handleMissed);
      socket.off(CALL_EVENTS.ENDED, handleEnded);
      socket.off(CALL_EVENTS.ERROR, handleCallError);
    };
  }, [conversationId, joinCallRoom, myUserId, setActiveCall, teardownRoom]);

  useEffect(() => () => {
    teardownRoom();
  }, [teardownRoom]);

  const startCall = useCallback((targetUserIds: string[], callType: CallType) => {
    if (!conversationId || !myUserId || targetUserIds.length === 0) {
      toast.error("No recipients available for this call");
      return;
    }

    connectSocket();
    const startedAt = new Date().toISOString();
    setError(null);
    setActiveCall({
      callId: `pending-${Date.now()}`,
      conversationId,
      roomCode: null,
      callType,
      direction: "outgoing",
      state: "ringing-outgoing",
      callerId: myUserId,
      callerName: authUser?.full_name || "You",
      targetUserIds,
      startedAt,
      acceptedUserIds: [],
    });

    getSocket().emit(CALL_EVENTS.START, {
      conversationId,
      targetUserIds,
      callType,
    });
  }, [authUser?.full_name, conversationId, myUserId, setActiveCall]);

  const acceptCall = useCallback(async () => {
    const currentCall = activeCallRef.current;
    if (!currentCall) {
      return;
    }

    try {
      connectSocket();
      setActiveCall({ ...currentCall, state: "connecting" });
      await joinCallRoom(currentCall.callId, currentCall.callType);
      getSocket().emit(CALL_EVENTS.ACCEPT, {
        callId: currentCall.callId,
        conversationId: currentCall.conversationId,
        roomCode: currentCall.roomCode,
      });
      setError(null);
    } catch (joinError) {
      const message = joinError instanceof Error ? joinError.message : "Failed to join call";
      setError(message);
      setActiveCall({ ...currentCall, state: "ringing-incoming" });
    }
  }, [joinCallRoom, setActiveCall]);

  const rejectCall = useCallback(() => {
    const currentCall = activeCallRef.current;
    if (!currentCall) {
      return;
    }

    connectSocket();
    getSocket().emit(CALL_EVENTS.REJECT, {
      callId: currentCall.callId,
      conversationId: currentCall.conversationId,
      roomCode: currentCall.roomCode,
    });
  }, []);

  const endCall = useCallback(() => {
    const currentCall = activeCallRef.current;
    if (!currentCall) {
      return;
    }

    connectSocket();
    getSocket().emit(
      currentCall.state === "ringing-outgoing" ? CALL_EVENTS.CANCEL : CALL_EVENTS.END,
      {
        callId: currentCall.callId,
        conversationId: currentCall.conversationId,
        roomCode: currentCall.roomCode,
      }
    );
  }, []);

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      return;
    }

    const nextEnabled = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(nextEnabled);
    setLocalStream(buildLocalStream(room.localParticipant));
    setIsMicEnabled(nextEnabled);
  }, []);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    const currentCall = activeCallRef.current;
    if (!room || currentCall?.callType !== "video") {
      setIsCameraEnabled(false);
      return;
    }

    const nextEnabled = !room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(nextEnabled);
    setLocalStream(buildLocalStream(room.localParticipant));
    setIsCameraEnabled(nextEnabled);
  }, []);

  const dismissCall = useCallback(() => {
    teardownRoom();
    setActiveCall(null);
    setError(null);
  }, [setActiveCall, teardownRoom]);

  return {
    activeCall,
    localStream,
    remoteParticipants,
    error,
    isMicEnabled,
    isCameraEnabled,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    dismissCall,
    toggleMicrophone,
    toggleCamera,
  };
}
