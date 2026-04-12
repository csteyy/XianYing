import { generateConnectId } from './config';
import { asrFileSubmit, asrFileQuery, uploadAudioForASR } from '../platform';
import type { FileASRSubmitConfig, ASRResult } from './types';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // 5 min max

interface FileASROptions {
  audioBlob: Blob;
  enableSpeakerInfo?: boolean;
  enablePunc?: boolean;
  onProgress?: (status: 'uploading' | 'queued' | 'processing' | 'done', detail?: string) => void;
}

export async function recognizeFile(options: FileASROptions): Promise<ASRResult> {
  const { audioBlob, enableSpeakerInfo = true, enablePunc = true, onProgress } = options;

  const requestId = generateConnectId();

  // Step 1: Upload audio to object storage to get a public URL
  onProgress?.('uploading');
  const audioUrl = await uploadAudioForASR(audioBlob);

  // Step 2: Submit recognition task
  const submitBody: FileASRSubmitConfig = {
    audio: {
      url: audioUrl,
      format: 'wav',
      codec: 'raw',
      rate: 16000,
      bits: 16,
      channel: 1,
    },
    request: {
      model_name: 'bigmodel',
      model_version: '400',
      ssd_version: '200',
      enable_itn: true,
      enable_punc: enablePunc,
      enable_ddc: false,
      enable_speaker_info: enableSpeakerInfo,
      enable_emotion_detection: true,
      enable_gender_detection: true,
      enable_lid: true,
      show_utterances: true,
      show_speech_rate: true,
      show_volume: true,
    },
  };

  const submitRes = await asrFileSubmit(JSON.stringify(submitBody), requestId);

  const submitStatus = submitRes.headers.get('x-api-status-code');
  if (submitStatus && submitStatus !== '20000000') {
    const msg = submitRes.headers.get('x-api-message') ?? 'Submit failed';
    throw new Error(`File ASR submit failed: ${submitStatus} - ${msg}`);
  }

  // Step 3: Poll for results
  onProgress?.('queued');

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const queryRes = await asrFileQuery(requestId);
    const statusCode = queryRes.headers.get('x-api-status-code');

    if (statusCode === '20000000') {
      onProgress?.('done');
      return (await queryRes.json()) as ASRResult;
    }

    if (statusCode === '20000001') {
      onProgress?.('processing');
      continue;
    }

    if (statusCode === '20000002') {
      onProgress?.('queued');
      continue;
    }

    if (statusCode === '20000003') {
      throw new Error('静音音频，无法识别');
    }

    if (statusCode && (statusCode.startsWith('4') || statusCode.startsWith('5'))) {
      const msg = queryRes.headers.get('x-api-message') ?? 'Unknown error';
      throw new Error(`File ASR error: ${statusCode} - ${msg}`);
    }
  }

  throw new Error('File ASR polling timeout');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
