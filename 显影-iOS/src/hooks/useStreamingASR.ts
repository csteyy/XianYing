import { useState, useRef, useCallback, useEffect } from 'react';
import { StreamingASRClient } from '../services/volcengine/streamingClient';
import type { ASRResult, ASRUtterance, ServerError } from '../services/volcengine/types';

interface UseStreamingASRReturn {
  /** Full recognized text so far */
  text: string;
  /** Current utterances list */
  utterances: ASRUtterance[];
  /** Whether connected to ASR service */
  isConnected: boolean;
  /** Last error, if any */
  error: ServerError | null;
  /** Start the ASR session */
  start: () => void;
  /** Send a PCM audio chunk */
  sendAudio: (pcmData: ArrayBuffer) => void;
  /** Signal end of audio stream */
  finish: () => void;
  /** Disconnect and cleanup */
  disconnect: () => void;
}

export function useStreamingASR(): UseStreamingASRReturn {
  const [text, setText] = useState('');
  const [utterances, setUtterances] = useState<ASRUtterance[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<ServerError | null>(null);
  const clientRef = useRef<StreamingASRClient | null>(null);

  const start = useCallback(() => {
    const client = new StreamingASRClient();

    client.on('onOpen', () => {
      setIsConnected(true);
      setError(null);
    });

    client.on('onResult', (result: ASRResult) => {
      if (result.result) {
        setText(result.result.text ?? '');
        if (result.result.utterances) {
          setUtterances(result.result.utterances);
        }
      }
    });

    client.on('onError', (err: ServerError) => {
      console.error('[useStreamingASR] Error:', err);
      setError(err);
    });

    client.on('onClose', () => {
      setIsConnected(false);
    });

    client.connect();
    clientRef.current = client;
  }, []);

  const sendAudio = useCallback((pcmData: ArrayBuffer) => {
    clientRef.current?.sendAudio(pcmData);
  }, []);

  const finish = useCallback(() => {
    clientRef.current?.sendLastPacket();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  return { text, utterances, isConnected, error, start, sendAudio, finish, disconnect };
}
