import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderError = 'denied' | 'unsupported' | 'unavailable' | null;

export interface RecorderState {
  recording: boolean;
  seconds: number;
  error: RecorderError;
  clearError: () => void;
  start: () => Promise<boolean>;
  stop: () => Promise<Blob | null>;
  cancel: () => void;
  supported: boolean;
}

export function useRecorder(): RecorderState {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<RecorderError>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const supported =
    typeof window !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined';

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearError = useCallback(() => setError(null), []);

  const start = useCallback(async (): Promise<boolean> => {
    if (recording) return true;
    if (!supported) {
      setError('unsupported');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => stream.getTracks().forEach((t) => t.stop());
      mr.start();
      mediaRef.current = mr;
      setError(null);
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      return true;
    } catch (err) {
      const name = (err as { name?: string } | null)?.name;
      setError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
      return false;
    }
  }, [recording, supported]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const mr = mediaRef.current;
    if (!mr) return null;
    clearTimer();
    return new Promise((resolve) => {
      mr.addEventListener(
        'stop',
        () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          mediaRef.current = null;
          setRecording(false);
          resolve(blob);
        },
        { once: true },
      );
      mr.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    const mr = mediaRef.current;
    clearTimer();
    if (mr && mr.state !== 'inactive') mr.stop();
    mediaRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setSeconds(0);
  }, []);

  useEffect(() => () => cancel(), [cancel]);

  return { recording, seconds, error, clearError, start, stop, cancel, supported };
}
