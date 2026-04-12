export const VOLCENGINE_CONFIG = {
  apiKey: import.meta.env.VITE_VOLCENGINE_API_KEY ?? '',
  streamResourceId: import.meta.env.VITE_VOLCENGINE_STREAM_RESOURCE_ID ?? 'volc.seedasr.sauc.duration',
  fileResourceId: import.meta.env.VITE_VOLCENGINE_FILE_RESOURCE_ID ?? 'volc.seedasr.auc',

  streamEndpoint: 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async',
  fileSubmitEndpoint: 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit',
  fileQueryEndpoint: 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query',

  proxyWsPath: '/asr-stream',
  proxyHttpPath: '/asr-file',

  audioUploadEndpoint: import.meta.env.VITE_AUDIO_UPLOAD_ENDPOINT ?? '',
} as const;

export function generateConnectId(): string {
  return crypto.randomUUID();
}

/**
 * Whether file ASR can upload audio via the web proxy endpoint.
 * For native (iOS), use canUploadAudio() from platform.ts instead.
 */
export function isFileASRAvailable(): boolean {
  return !!VOLCENGINE_CONFIG.audioUploadEndpoint;
}
