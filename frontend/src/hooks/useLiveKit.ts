import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  LocalParticipant,
  LocalVideoTrack,
  ConnectionState,
  DisconnectReason,
} from 'livekit-client';
import { livekitService } from '@/services/livekitService';
import { useMeetingStore } from '@/stores/meetingStore';
import { useMediaStore } from '@/stores/mediaStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFilterStore } from '@/stores/filterStore';

/**
 * Core LiveKit hook — replaces the old P2P useWebRTC hook.
 *
 * Responsibilities:
 * 1. Fetch LiveKit token from backend
 * 2. Connect to LiveKit Room (SFU)
 * 3. Sync remote participants → meetingStore
 * 4. Sync remote tracks → participant streams in store
 * 5. Expose media control functions (camera, mic, screen share)
 * 6. Republish canvas/filter stream when AI filter is active
 * 7. Clean up on unmount
 */
export function useLiveKit(roomCode: string | null) {
  const roomRef = useRef<Room | null>(null);

  /**
   * Tracks the currently published custom (canvas) LocalVideoTrack.
   * When a filter is active, this holds the canvas track we manually published.
   * When the filter is off, this is null (LiveKit manages the native camera track).
   */
  const publishedCustomTrackRef = useRef<LocalVideoTrack | null>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const myUserId = useAuthStore((s) => s.user?._id);

  // Subscribe to filter and local stream for the republish effect.
  // These drive the effect that swaps native camera ↔ canvas track in the room.
  const activeFilter = useFilterStore((s) => s.activeFilter);
  const localStream = useMediaStore((s) => s.localStream);

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
    setIsAudioMuted,
    setIsVideoMuted,
    setIsScreenSharing,
    setScreenStream,
  } = useMediaStore();

  // =========================================================================
  // CONNECT TO LIVEKIT ROOM
  // =========================================================================

  useEffect(() => {
    if (!roomCode || !myUserId) return;

    let cancelled = false;
    const newRoom = new Room({
      adaptiveStream: false, // MUST be false when manually managing MediaStream objects instead of using track.attach()
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
    roomRef.current = newRoom;

    // ------- ROOM EVENT HANDLERS -------

    const handleParticipantConnected = (participant: RemoteParticipant) => {
      console.log("[LiveKit Debug] Participant connected:", participant.identity, "camera:", participant.isCameraEnabled);
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
      console.log("[LiveKit Debug] Track subscribed:", publication.source, "for user:", participant.identity, "track:", track);
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

        // Đảm bảo track vừa subscribe được bao gồm trong stream (đề phòng race condition)
        const hasTrack = combinedStream.getTracks().some(t => t.id === track.mediaStreamTrack.id);
        if (!hasTrack) {
          combinedStream.addTrack(track.mediaStreamTrack);
        }

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
        if (_track) {
          const trackInStream = remainingStream.getTracks().find(t => t.id === _track.mediaStreamTrack.id);
          if (trackInStream) {
            remainingStream.removeTrack(trackInStream);
          }
        }
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

    /**
     * When a local track is published/unpublished, update localStream in the store —
     * BUT only when there is NO active filter. When a filter is running, localStream
     * is owned by useVideoFilter (it holds the canvas stream). We must not override
     * it with a raw LiveKit stream, otherwise the filter preview would flicker and
     * the republish effect would fire spuriously.
     */
    const handleLocalTrackPublished = () => {
      if (useFilterStore.getState().activeFilter !== 'none') return;
      const localP = newRoom.localParticipant;
      const localMediaStream = buildLocalStream(localP);
      setLocalStream(localMediaStream);
    };

    const handleLocalTrackUnpublished = () => {
      if (useFilterStore.getState().activeFilter !== 'none') return;
      const localP = newRoom.localParticipant;
      const localMediaStream = buildLocalStream(localP);
      setLocalStream(localMediaStream);
    };

    // Register events
    newRoom.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    newRoom.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    newRoom.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    newRoom.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    newRoom.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
    newRoom.on(RoomEvent.Disconnected, handleDisconnected);
    newRoom.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    newRoom.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);

    // Connect
    const connect = async () => {
      try {
        const { token, url } = await livekitService.getToken(roomCode);
        if (cancelled) return;

        await newRoom.connect(url, token);
        if (cancelled) {
          newRoom.disconnect();
          return;
        }

        setRoom(newRoom);

        // Enable camera and mic based on current media store state
        const mediaState = useMediaStore.getState();
        await newRoom.localParticipant.setCameraEnabled(!mediaState.isVideoMuted);
        await newRoom.localParticipant.setMicrophoneEnabled(!mediaState.isAudioMuted);

        // Build initial local stream
        const localMediaStream = buildLocalStream(newRoom.localParticipant);
        setLocalStream(localMediaStream);

        // Sync already-connected remote participants
        newRoom.remoteParticipants.forEach((participant) => {
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
      newRoom.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      newRoom.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      newRoom.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      newRoom.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      newRoom.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
      newRoom.off(RoomEvent.Disconnected, handleDisconnected);
      newRoom.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      newRoom.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
      newRoom.disconnect();
      roomRef.current = null;
      setRoom(null);
    };
  }, [roomCode, myUserId]);

  // =========================================================================
  // FILTER TRACK REPUBLISH
  //
  // When an AI filter is active, `localStream` (mediaStore) is replaced with a
  // canvas-captured MediaStream by useVideoFilter. This effect detects that change
  // and swaps what LiveKit publishes:
  //
  //   Filter ON  → unpublish native camera (keep physical camera alive for processor)
  //                → publish canvas video track with source=Camera, simulcast=false
  //
  //   Filter OFF → unpublish canvas track
  //                → re-enable native camera via setCameraEnabled(true)
  // =========================================================================

  useEffect(() => {
    const currentRoom = roomRef.current;
    if (!currentRoom?.localParticipant || !isConnected) return;

    const localParticipant = currentRoom.localParticipant;

    const handleFilterPublish = async () => {
      if (activeFilter !== 'none') {
        // ── FILTER IS ACTIVE ──────────────────────────────────────────────
        // Guard: do nothing if camera is muted or canvas stream not ready yet
        const isVideoMuted = useMediaStore.getState().isVideoMuted;
        if (isVideoMuted || !localStream) return;

        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) return;

        // Idempotency guard: skip if this exact MST is already published
        if (publishedCustomTrackRef.current?.mediaStreamTrack === videoTrack) {
          return;
        }

        // 1. Unpublish any previously published canvas track
        if (publishedCustomTrackRef.current) {
          try {
            await localParticipant.unpublishTrack(publishedCustomTrackRef.current);
          } catch (e) {
            console.warn('[LiveKit Filter] Could not unpublish old canvas track:', e);
          }
          publishedCustomTrackRef.current = null;
        }

        // 2. Unpublish LiveKit's native camera track.
        //    IMPORTANT: pass stopOnUnpublish=false so the underlying MediaStreamTrack
        //    stays alive — VideoFilterProcessor.sourceVideo still needs it to render
        //    frames onto the canvas.
        const cameraPub = localParticipant.getTrackPublication(Track.Source.Camera);
        if (cameraPub?.track) {
          try {
            await localParticipant.unpublishTrack(
              cameraPub.track as LocalVideoTrack,
              false, // stopOnUnpublish=false → keep physical camera running
            );
          } catch (e) {
            console.warn('[LiveKit Filter] Could not unpublish native camera:', e);
          }
        }

        // 3. Publish the canvas video track as the Camera source
        //    simulcast=false: canvas streams have a fixed resolution/framerate;
        //    simulcast layers would just waste bandwidth on identical quality.
        //    userProvidedTrack=true: tells LiveKit not to restart this track if
        //    it ends (canvas tracks don't auto-restart like device tracks).
        try {
          const canvasVideoTrack = new LocalVideoTrack(videoTrack, undefined, true);
          await localParticipant.publishTrack(canvasVideoTrack, {
            source: Track.Source.Camera,
            simulcast: false,
          });
          publishedCustomTrackRef.current = canvasVideoTrack;
          console.log('[LiveKit Filter] Canvas track published to room.');
        } catch (e) {
          console.error('[LiveKit Filter] Failed to publish canvas track:', e);
        }

      } else {
        // ── FILTER IS OFF ─────────────────────────────────────────────────

        // 1. Unpublish the canvas track (remotes stop receiving the filtered video)
        if (publishedCustomTrackRef.current) {
          try {
            await localParticipant.unpublishTrack(publishedCustomTrackRef.current);
            publishedCustomTrackRef.current = null;
            console.log('[LiveKit Filter] Canvas track removed from room.');
          } catch (e) {
            console.warn('[LiveKit Filter] Could not unpublish canvas track:', e);
          }
        }

        const isVideoMuted = useMediaStore.getState().isVideoMuted;
        const cameraPub = localParticipant.getTrackPublication(Track.Source.Camera);

        // 2. Re-enable native camera only if user has not muted it AND the native
        //    track is not already published (avoids double-publish after a no-op).
        //    DO NOT call setLocalStream() here — that would create a new MediaStream
        //    object on every run, changing the `localStream` dep and re-triggering
        //    this very effect → infinite loop.
        //    localStream is updated automatically by handleLocalTrackPublished when
        //    setCameraEnabled(true) causes LiveKit to publish the native track.
        if (!isVideoMuted && !cameraPub) {
          try {
            await localParticipant.setCameraEnabled(true);
          } catch (e) {
            console.error('[LiveKit Filter] Failed to restore native camera:', e);
          }
        }
      }
    };

    handleFilterPublish();
  // localStream is intentionally in the deps: when useVideoFilter replaces
  // localStream with the canvas stream, this effect must fire to publish it.
  }, [activeFilter, localStream, isConnected]);

  // =========================================================================
  // MEDIA CONTROLS
  // =========================================================================

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;

    const localParticipant = room.localParticipant;
    const isFilterActive = useFilterStore.getState().activeFilter !== 'none';

    // Use mediaStore as the source of truth for "is the camera currently on",
    // because when a filter is active the native LiveKit isCameraEnabled might
    // return false (the native track was unpublished) even though the user's
    // camera is logically on (canvas stream is being published).
    const isCurrentlyEnabled = !useMediaStore.getState().isVideoMuted;
    const newEnabled = !isCurrentlyEnabled;

    if (!newEnabled) {
      // ── TURNING CAMERA OFF ────────────────────────────────────────────

      if (isFilterActive && publishedCustomTrackRef.current) {
        // Unpublish the canvas track so remotes see the camera as off
        try {
          await localParticipant.unpublishTrack(publishedCustomTrackRef.current);
          publishedCustomTrackRef.current = null;
        } catch (e) {
          console.warn('[LiveKit] Could not unpublish canvas track on cam-off:', e);
        }
      }

      // Disable the physical camera (also unpublishes any remaining native track)
      await localParticipant.setCameraEnabled(false);

    } else {
      // ── TURNING CAMERA ON ─────────────────────────────────────────────

      // Re-enable the physical camera. LiveKit will publish the native track.
      await localParticipant.setCameraEnabled(true);

      if (!isFilterActive) {
        // No filter: update localStream with the new native camera stream so
        // the local preview tile refreshes.
        const localMediaStream = buildLocalStream(localParticipant);
        setLocalStream(localMediaStream);
      }
      // If filter IS active: handleLocalTrackPublished is suppressed (filter guard),
      // and useVideoFilter's second effect will detect that localStream changed to
      // the new raw camera stream and restart the canvas pipeline automatically.
      // Once the pipeline emits a new canvas stream, setLocalStream(canvasStream)
      // is called by useVideoFilter, which triggers our republish useEffect above.
    }

    setIsVideoMuted(!newEnabled);
  }, [setLocalStream, setIsVideoMuted]);

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;

    const newEnabled = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(newEnabled);
    setIsAudioMuted(!newEnabled);
  }, [setIsAudioMuted]);

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
      setRoom(null);
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
    room,
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
      (pub.source === Track.Source.Camera || pub.source === Track.Source.Microphone)
    ) {
      tracks.push(pub.track.mediaStreamTrack);
    }
  });

  return new MediaStream(tracks);
}

/**
 * Build a MediaStream from local participant's camera + mic tracks.
 * NOTE: Only called when no filter is active. When a filter is active,
 * localStream is managed by useVideoFilter (canvas stream).
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
