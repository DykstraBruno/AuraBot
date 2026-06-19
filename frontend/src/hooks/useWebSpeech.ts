import { useState, useRef, useCallback, useEffect } from 'react';

export type SpeechState = 'idle' | 'listening' | 'processing';

interface UseWebSpeechOptions {
  onResult: (text: string) => void;
  onError?: (msg: string) => void;
}

interface UseWebSpeechReturn {
  state: SpeechState;
  setState: React.Dispatch<React.SetStateAction<SpeechState>>;
  start: (language: 'pt' | 'en') => void;
  cancel: () => void;
  error: string | null;
  supported: boolean;
}

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
    : null;

export function useWebSpeech({ onResult, onError }: UseWebSpeechOptions): UseWebSpeechReturn {
  const [state, setState] = useState<SpeechState>('idle');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const supported = Boolean(SpeechRecognitionAPI);

  const cancel = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setState('idle');
  }, []);

  const start = useCallback((language: 'pt' | 'en') => {
    if (!supported) {
      const msg = 'Reconhecimento de voz não suportado. Use Chrome ou Edge.';
      setError(msg);
      onError?.(msg);
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    recognition.lang = language === 'pt' ? 'pt-BR' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState('listening');
      setError(null);
    };

    recognition.onresult = (event: any) => {
      const text: string = event.results[0]?.[0]?.transcript ?? '';
      if (text.trim()) {
        setState('processing');
        onResult(text.trim());
      } else {
        setState('idle');
      }
    };

    recognition.onerror = (event: any) => {
      let msg = 'Erro ao reconhecer voz. Tente novamente.';
      if (event.error === 'no-speech')   msg = 'Nenhuma fala detectada. Tente novamente.';
      if (event.error === 'not-allowed') msg = 'Permissão de microfone negada. Permita nas configurações do navegador.';
      if (event.error === 'network')     msg = 'Erro de rede no reconhecimento. Verifique sua conexão.';
      setError(msg);
      onError?.(msg);
      setState('idle');
    };

    recognition.onend = () => {
      setState(prev => (prev === 'listening' ? 'idle' : prev));
    };

    try { recognition.start(); } catch { setState('idle'); }
  }, [supported, onResult, onError]);

  useEffect(() => () => { recognitionRef.current?.abort(); }, []);

  return { state, setState, start, cancel, error, supported };
}
