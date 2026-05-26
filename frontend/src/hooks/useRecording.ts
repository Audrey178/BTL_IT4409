import { useEffect, useState, useRef } from 'react';
import { getSocket } from '@/socket/socket';
import { useMeetingStore } from '@/stores/meetingStore';
import { recordingService } from '@/services/recordingService';
import { toast } from 'sonner';

export function useRecording() {
  const roomCode = useMeetingStore((s) => s.roomCode);
  const isRecording = useMeetingStore((s) => s.isRecording);
  const setIsRecording = useMeetingStore((s) => s.setIsRecording);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync initial status when hook is mounted or roomCode changes
  useEffect(() => {
    if (!roomCode) return;

    recordingService.getLiveKitRecordingStatus(roomCode)
      .then((res) => {
        if (res.success) {
          setIsRecording(res.isRecording);
          if (res.isRecording && res.startTime) {
            const elapsed = Math.round((Date.now() - new Date(res.startTime).getTime()) / 1000);
            setDuration(elapsed > 0 ? elapsed : 0);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to fetch recording status:', err);
      });
  }, [roomCode, setIsRecording]);

  // Sync duration timer based on isRecording
  useEffect(() => {
    if (isRecording) {
      // Start or resume counting
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  // Socket event listener for sync across all clients
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomCode) return;

    const handleRecordingStatus = (data: { isRecording: boolean; recorderId?: string }) => {
      setIsRecording(data.isRecording);
      if (data.isRecording) {
        toast.info('Meeting recording has started');
      } else {
        toast.info('Meeting recording has stopped and is saving...');
      }
    };

    socket.on('recording:status', handleRecordingStatus);

    return () => {
      socket.off('recording:status', handleRecordingStatus);
    };
  }, [roomCode, setIsRecording]);

  const startRecording = async () => {
    if (!roomCode) return;
    setIsProcessing(true);
    try {
      await recordingService.startLiveKitRecording(roomCode);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to start recording');
    } finally {
      setIsProcessing(false);
    }
  };

  const stopRecording = async () => {
    if (!roomCode) return;
    setIsProcessing(true);
    try {
      await recordingService.stopLiveKitRecording(roomCode);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to stop recording');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const pad = (num: number) => String(num).padStart(2, '0');

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  return {
    isRecording,
    duration,
    formattedDuration: formatDuration(duration),
    isProcessing,
    startRecording,
    stopRecording,
  };
}
