export { VOLCENGINE_CONFIG, generateConnectId } from './config';
export { encodeFullClientRequest, encodeAudioRequest, decodeServerFrame } from './protocol';
export { StreamingASRClient } from './streamingClient';
export { recognizeFile } from './fileClient';
export * from './types';
export { isNative, createASRWebSocket, asrFileSubmit, asrFileQuery, uploadAudioForASR } from '../platform';
