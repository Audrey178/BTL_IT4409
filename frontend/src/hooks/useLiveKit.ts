import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  LocalParticipant,
  ConnectionState,
  DisconnectReason,
} from 'livekit-client';
import { livekitService } from '@/services/livekitService';
import { useMeetingStore } from '@/stores/meetingStore';
import { useMediaStore } from '@/stores/mediaStore';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * Core LiveKit hook — replaces the old P2P useWebRTC hook.
 *
 * Responsibilities:
 * 1. Fetch LiveKit token from backend
 * 2. Connect to LiveKit Room (SFU)
 * 3. Sync remote participants → meetingStore
 * 4. Sync remote tracks → participant streams in store
 * 5. Expose media control functions (camera, mic, screen share)
 * 6. Clean up on unmount
 */
export function useLiveKit(roomCode: string | null) {
  const roomRef = useRef<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const myUserId = useAuthStore((s) => s.user?._id);

  const {
    addParticipant,
    removeParticipant,
    updateParticipantStream,
    updateParticipantScreenStream,
    clearParticipantScreenStream,
    setScreenSharingUserId,
  } = useMeetingStore();

  const {
    setLocalStream,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    setIsScreenSharing,
    setScreenStream,
  } = useMediaStore();

  // =========================================================================
  // CONNECT TO LIVEKIT ROOM
  // =========================================================================

  useEffect(() => {
    if (!roomCode || !myUserId) return;

    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      // Publish defaults — match existing quality expectations
      videoCaptureDefaults: {
        resolution: { width: 1280, height: 720, frameRate: 30 },
      },
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    roomRef.current = room;

    // ------- ROOM EVENT HANDLERS -------

    const handleParticipantConnected = (participant: RemoteParticipant) => {
      addParticipant({
        id: participant.identity,
        fullName: participant.name || participant.identity,
        isActive: true,
        isAudioMuted: !participant.isMicrophoneEnabled,
        isVideoMuted: !participant.isCameraEnabled,
      });
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      removeParticipant(participant.identity);
    };

    const handleTrackSubscribed = (
      track: RemoteTrackPublication['track'],
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (!track) return;

      const mediaStream = new MediaStream([track.mediaStreamTrack]);

      if (publication.source === Track.Source.ScreenShare) {
        updateParticipantScreenStream(participant.identity, mediaStream);
        // Set screenSharingUserId so UI switches to presentation mode
        // (covers edge case: user joins AFTER screen share already started)
        setScreenSharingUserId(participant.identity);
      } else if (
        publication.source === Track.Source.Camera ||
        publication.source === Track.Source.Microphone
      ) {
        // Build a combined stream with all subscribed camera + mic tracks
        const combinedStream = buildParticipantStream(participant);
        updateParticipantStream(participant.identity, combinedStream);
      }
    };

    const handleTrackUnsubscribed = (
      _track: RemoteTrackPublication['track'],
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (publication.source === Track.Source.ScreenShare) {
        clearParticipantScreenStream(participant.identity);
        // Clear screenSharingUserId so UI switches back to grid mode
        const currentSharer = useMeetingStore.getState().screenSharingUserId;
        if (currentSharer === participant.identity) {
          setScreenSharingUserId(null);
        }
      } else {
        // Rebuild the stream without the removed track
        const remainingStream = buildParticipantStream(participant);
        updateParticipantStream(participant.identity, remainingStream);
      }
    };

    const handleConnectionStateChanged = (state: ConnectionState) => {
      setIsConnected(state === ConnectionState.Connected);
    };

    const handleDisconnected = (reason?: DisconnectReason) => {
      setIsConnected(false);
      if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
        // Handled by useRoomEvents (room:force_disconnect)
      }
    };

    const handleLocalTrackPublished = () => {
      // Update localStream in mediaStore whenever local tracks change
      const localP = room.localParticipant;
      const localMediaStream = buildLocalStream(localP);
      setLocalStream(localMediaStream);
    };

    const handleLocalTrackUnpublished = () => {
      const localP = room.localParticipant;
      const localMediaStream = buildLocalStream(localP);
      setLocalStream(localMediaStream);
    };

    // Register events
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);

    // Connect
    const connect = async () => {
      try {
        const { token, url } = await livekitService.getToken(roomCode);
        if (cancelled) return;

        await room.connect(url, token);
        if (cancelled) {
          room.disconnect();
          return;
        }

        // Enable camera and mic based on current media store state
        const mediaState = useMediaStore.getState();
        await room.localParticipant.setCameraEnabled(!mediaState.isVideoMuted);
        await room.localParticipant.setMicrophoneEnabled(!mediaState.isAudioMuted);

        // Build initial local stream
        const localMediaStream = buildLocalStream(room.localParticipant);
        setLocalStream(localMediaStream);

        // Sync already-connected remote participants
        room.remoteParticipants.forEach((participant) => {
          handleParticipantConnected(participant);

          // Sync their existing tracks
          participant.trackPublications.forEach((pub) => {
            if (pub.track && pub.isSubscribed) {
              handleTrackSubscribed(pub.track, pub as RemoteTrackPublication, participant);
            }
          });
        });

        setIsConnected(true);
        setConnectionError(null);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to connect to LiveKit';
          setConnectionError(message);
          console.error('LiveKit connection error:', err);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
      room.disconnect();
      roomRef.current = null;
    };
  }, [roomCode, myUserId]);

  // =========================================================================
  // MEDIA CONTROLS
  // =========================================================================

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;

    const newEnabled = !room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(newEnabled);

    // Update local stream in store
    const localMediaStream = buildLocalStream(room.localParticipant);
    setLocalStream(localMediaStream);
  }, [setLocalStream]);

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;

    const newEnabled = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(newEnabled);
  }, []);

  const toggleScreenShare = useCallback(async (): Promise<boolean> => {
    const room = roomRef.current;
    if (!room?.localParticipant) return false;

    const currentlySharing = room.localParticipant.isScreenShareEnabled;

    try {
      await room.localParticipant.setScreenShareEnabled(!currentlySharing, {
        audio: true,
      });

      if (!currentlySharing) {
        // Started sharing — get the screen share track
        setIsScreenSharing(true);
        const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        if (pub?.track) {
          const screenMediaStream = new MediaStream([pub.track.mediaStreamTrack]);
          setScreenStream(screenMediaStream);

          // Listen for browser "Stop sharing" button
          pub.track.mediaStreamTrack.onended = () => {
            room.localParticipant.setScreenShareEnabled(false);
            setIsScreenSharing(false);
            setScreenStream(null);
          };
        }
      } else {
        // Stopped sharing
        setIsScreenSharing(false);
        setScreenStream(null);
      }

      return true;
    } catch {
      // User cancelled the screen picker — not an error
      return false;
    }
  }, [setIsScreenSharing, setScreenStream]);

  const disconnect = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      room.disconnect();
      roomRef.current = null;
    }
    setIsConnected(false);
  }, []);

  /**
   * Get the local camera MediaStreamTrack for face recognition.
   * Returns the raw track from LiveKit's local camera publication.
   */
  const getLocalCameraTrack = useCallback((): MediaStreamTrack | null => {
    const room = roomRef.current;
    if (!room?.localParticipant) return null;

    const cameraPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    return cameraPub?.track?.mediaStreamTrack ?? null;
  }, []);

  return {
    room: roomRef.current,
    isConnected,
    connectionError,
    toggleCamera,
    toggleMicrophone,
    toggleScreenShare,
    disconnect,
    getLocalCameraTrack,
  };
}

// =========================================================================
// HELPERS
// =========================================================================

/**
 * Build a MediaStream from all camera + mic tracks of a remote participant.
 */
function buildParticipantStream(participant: RemoteParticipant): MediaStream {
  const tracks: MediaStreamTrack[] = [];

  participant.trackPublications.forEach((pub) => {
    if (
      pub.track &&
      pub.isSubscribed &&
      (pub.source === Track.Source.Camera || pub.source === Track.Source.Microphone)
    ) {
      tracks.push(pub.track.mediaStreamTrack);
    }
  });

  return new MediaStream(tracks);
}

/**
 * Build a MediaStream from local participant's camera + mic tracks.
 */
function buildLocalStream(localParticipant: LocalParticipant): MediaStream {
  const tracks: MediaStreamTrack[] = [];

  localParticipant.trackPublications.forEach((pub) => {
    if (
      pub.track &&
      (pub.source === Track.Source.Camera || pub.source === Track.Source.Microphone)
    ) {
      tracks.push(pub.track.mediaStreamTrack);
    }
  });

  return new MediaStream(tracks);
}
