import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioRecorder, type PCMChunkHandler } from '../services/audio/recorder';

interface UseAudioCaptureReturn {
  isRecording: boolean;
  volume: number;
  start: (onChunk: PCMChunkHandler) => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  /** Stop recording. Returns the full audio as a WAV ArrayBuffer. */
  stop: () => ArrayBuffer | null;
}

export function useAudioCapture(): UseAudioCaptureReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(0);
  const recorderRef = useRef<AudioRecorder | null>(null);

  const start = useCallback(async (onChunk: PCMChunkHandler) => {
    const recorder = new AudioRecorder();
    recorder.onPCMChunk(onChunk);
    recorder.onVolume(setVolume);

    await recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  const pause = useCallback(() => {
    recorderRef.current?.pause();
    setIsRecording(false);
  }, []);

  const resume = useCallback(async () => {
    await recorderRef.current?.resume();
    setIsRecording(true);
  }, []);

  const stop = useCallback((): ArrayBuffer | null => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    const wav = recorder.stop();
    recorderRef.current = null;
    setIsRecording(false);
    setVolume(0);
    return wav;
  }, []);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.isRecording) {
        recorderRef.current.stop();
      }
    };
  }, []);

  return { isRecording, volume, start, pause, resume, stop };
}
