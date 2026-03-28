import { useState, useRef, useCallback } from 'react';

export type RecordingState = 'idle' | 'recording' | 'processing';

interface UseVoiceRecorderReturn {
  state: RecordingState;
  duration: number;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  cancel: () => void;
  error: string | null;
}

const SUPPORTED_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

function getSupportedMimeType(): string {
  for (const type of SUPPORTED_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm';
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  const start = useCallback(async () => {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100); // coleta chunks a cada 100ms
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Permissão de microfone negada. Permita o acesso nas configurações do navegador.');
      } else if (err.name === 'NotFoundError') {
        setError('Nenhum microfone encontrado.');
      } else {
        setError('Não foi possível acessar o microfone.');
      }
      setState('idle');
    }
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }

      resolveRef.current = resolve;
      setState('processing');
      clearInterval(timerRef.current);

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setState('idle');
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setState('idle');
    setDuration(0);
  }, []);

  return { state, duration, start, stop, cancel, error };
}
