import { useState, useRef, useCallback } from 'react';
import { uploadAudioForASR, asrFileSubmit, asrFileQuery } from '../services/platform';

export interface FileASRUtterance {
  text: string;
  start_time: number;
  end_time: number;
  definite?: boolean;
  speaker?: number;
  words?: Array<{ text: string; start_time: number; end_time: number; blank_duration: number }>;
  additions?: {
    emotion?: string;
    gender?: string;
    speech_rate?: number;
    volume?: number;
    lid_lang?: string;
  };
}

export interface FileASRResult {
  result?: {
    text?: string;
    utterances?: FileASRUtterance[];
  };
  audio_info?: { duration: number };
}

type FileASRStatus = 'idle' | 'uploading' | 'queued' | 'processing' | 'done' | 'error';

const POLL_INTERVAL = 2000;
const MAX_POLLS = 150;

export function useFileASR() {
  const [status, setStatus] = useState<FileASRStatus>('idle');
  const [error, setError] = useState('');
  const abortRef = useRef(false);

  const submit = useCallback(async (blob: Blob): Promise<FileASRResult | null> => {
    abortRef.current = false;
    setStatus('uploading');
    setError('');

    try {
      const audioUrl = await uploadAudioForASR(blob);
      if (abortRef.current) return null;

      const requestId = crypto.randomUUID();
      const submitBody = JSON.stringify({
        audio: { format: 'wav', url: audioUrl },
        request: {
          model_name: 'bigmodel',
          enable_itn: true,
          enable_punc: true,
          show_utterances: true,
          enable_speaker_info: true,
          enable_emotion_detection: true,
          enable_gender_detection: true,
          show_speech_rate: true,
          show_volume: true,
        },
      });

      const submitRes = await asrFileSubmit(submitBody, requestId);
      const submitStatus = submitRes.headers.get('x-api-status-code') ?? '';
      if (submitStatus !== '20000000') {
        const msg = submitRes.headers.get('x-api-message') ?? 'Submit failed';
        throw new Error(`ASR submit: ${msg} (${submitStatus})`);
      }

      setStatus('queued');
      if (abortRef.current) return null;

      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        if (abortRef.current) return null;

        const queryRes = await asrFileQuery(requestId);
        const queryStatus = queryRes.headers.get('x-api-status-code') ?? '';

        if (queryStatus === '20000000') {
          setStatus('done');
          return queryRes.json() as Promise<FileASRResult>;
        }

        if (queryStatus === '20000001') {
          setStatus('processing');
        } else if (queryStatus === '20000002') {
          setStatus('queued');
        } else {
          const msg = queryRes.headers.get('x-api-message') ?? 'Unknown error';
          throw new Error(`ASR query: ${msg} (${queryStatus})`);
        }
      }

      throw new Error('ASR polling timeout');
    } catch (err) {
      if (!abortRef.current) {
        setStatus('error');
        setError(String(err));
      }
      return null;
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { submit, status, error, abort };
}
