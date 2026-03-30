import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { VOLCENGINE_CONFIG } from './volcengine/config';

// ---------------------------------------------------------------------------
// Native plugin interface
// ---------------------------------------------------------------------------

interface NativeWebSocketPlugin {
  connect(options: { url: string; headers: Record<string, string> }): Promise<void>;
  send(options: { data: string }): Promise<void>;
  close(): Promise<void>;
  addListener(event: 'open', handler: () => void): Promise<PluginListenerHandle>;
  addListener(
    event: 'message',
    handler: (info: { data?: string; text?: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'close',
    handler: (info: { code: number; reason: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'error',
    handler: (info: { message: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const NativeWS = registerPlugin<NativeWebSocketPlugin>('NativeWebSocket');

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// ---------------------------------------------------------------------------
// WebSocket-like interface consumed by StreamingASRClient
// ---------------------------------------------------------------------------

export interface WebSocketLike {
  readonly readyState: number;
  binaryType: string;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onclose: ((ev: CloseEvent | Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  send(data: ArrayBuffer): void;
  close(): void;
}

export const WS_OPEN = 1;

// ---------------------------------------------------------------------------
// Native WebSocket wrapper (iOS)
// ---------------------------------------------------------------------------

class NativeWebSocketWrapper implements WebSocketLike {
  private _readyState = 0; // CONNECTING
  private handles: PluginListenerHandle[] = [];

  binaryType = 'arraybuffer';
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent | Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  get readyState() {
    return this._readyState;
  }

  constructor(url: string, headers: Record<string, string>) {
    this.bootstrap(url, headers);
  }

  private async bootstrap(url: string, headers: Record<string, string>) {
    try {
      const h1 = await NativeWS.addListener('open', () => {
        this._readyState = 1;
        this.onopen?.(new Event('open'));
      });

      const h2 = await NativeWS.addListener('message', (info) => {
        if (info.data) {
          const buf = base64ToArrayBuffer(info.data);
          this.onmessage?.(new MessageEvent('message', { data: buf }));
        }
      });

      const h3 = await NativeWS.addListener('close', (info) => {
        this._readyState = 3;
        this.onclose?.(new CloseEvent('close', { code: info.code, reason: info.reason }));
        this.cleanup();
      });

      const h4 = await NativeWS.addListener('error', (info) => {
        this.onerror?.(new ErrorEvent('error', { message: info.message }));
      });

      this.handles.push(h1, h2, h3, h4);
      await NativeWS.connect({ url, headers });
    } catch (err) {
      this._readyState = 3;
      this.onerror?.(new ErrorEvent('error', { message: String(err) }));
    }
  }

  send(data: ArrayBuffer): void {
    NativeWS.send({ data: arrayBufferToBase64(data) }).catch((err) => {
      console.error('[NativeWS] send error:', err);
    });
  }

  close(): void {
    this._readyState = 2; // CLOSING
    NativeWS.close().catch(() => {});
    this.cleanup();
  }

  private cleanup() {
    for (const h of this.handles) h.remove();
    this.handles = [];
  }
}

// ---------------------------------------------------------------------------
// Public: create a WebSocket for streaming ASR
// ---------------------------------------------------------------------------

export function createASRWebSocket(connectId: string): WebSocketLike {
  const native = isNative();
  console.log('[ASR] createASRWebSocket — isNative:', native, 'endpoint:', VOLCENGINE_CONFIG.streamEndpoint, 'apiKey set:', !!VOLCENGINE_CONFIG.apiKey);

  if (native) {
    const headers: Record<string, string> = {
      'x-api-key': VOLCENGINE_CONFIG.apiKey,
      'X-Api-Resource-Id': VOLCENGINE_CONFIG.streamResourceId,
      'X-Api-Connect-Id': connectId,
    };
    return new NativeWebSocketWrapper(VOLCENGINE_CONFIG.streamEndpoint, headers);
  }

  const wsUrl = new URL(VOLCENGINE_CONFIG.proxyWsPath, window.location.href);
  wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  wsUrl.searchParams.set('connect_id', connectId);
  wsUrl.searchParams.set('resource_id', VOLCENGINE_CONFIG.streamResourceId);
  const ws = new WebSocket(wsUrl.toString());
  ws.binaryType = 'arraybuffer';
  return ws;
}

// ---------------------------------------------------------------------------
// Public: platform-aware HTTP for file ASR
// ---------------------------------------------------------------------------

export async function asrFileSubmit(
  body: string,
  requestId: string,
): Promise<Response> {
  if (isNative()) {
    return fetch(VOLCENGINE_CONFIG.fileSubmitEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': VOLCENGINE_CONFIG.apiKey,
        'X-Api-Resource-Id': VOLCENGINE_CONFIG.fileResourceId,
        'X-Api-Request-Id': requestId,
        'X-Api-Sequence': '-1',
      },
      body,
    });
  }

  return fetch(`${VOLCENGINE_CONFIG.proxyHttpPath}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
      'X-Resource-Id': VOLCENGINE_CONFIG.fileResourceId,
    },
    body,
  });
}

export async function asrFileQuery(requestId: string): Promise<Response> {
  if (isNative()) {
    return fetch(VOLCENGINE_CONFIG.fileQueryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': VOLCENGINE_CONFIG.apiKey,
        'X-Api-Resource-Id': VOLCENGINE_CONFIG.fileResourceId,
        'X-Api-Request-Id': requestId,
        'X-Api-Sequence': '-1',
      },
      body: JSON.stringify({}),
    });
  }

  return fetch(`${VOLCENGINE_CONFIG.proxyHttpPath}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
      'X-Resource-Id': VOLCENGINE_CONFIG.fileResourceId,
    },
    body: JSON.stringify({}),
  });
}

// ---------------------------------------------------------------------------
// Public: upload audio blob → public URL
// ---------------------------------------------------------------------------

export async function uploadAudioForASR(wavBlob: Blob): Promise<string> {
  const endpoint = VOLCENGINE_CONFIG.audioUploadEndpoint;
  if (!endpoint) {
    throw new Error(
      '未配置音频上传地址 (VITE_AUDIO_UPLOAD_ENDPOINT)。' +
        '文件识别 ASR 需要一个公开可访问的音频 URL。' +
        '请配置 TOS / S3 等对象存储的上传端点。',
    );
  }

  const formData = new FormData();
  formData.append('file', wavBlob, 'recording.wav');

  const res = await fetch(endpoint, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`音频上传失败: ${res.status}`);

  const json = (await res.json()) as { url: string };
  if (!json.url) throw new Error('上传响应中缺少 url 字段');
  return json.url;
}

// ---------------------------------------------------------------------------
// Helpers: base64 ↔ ArrayBuffer
// ---------------------------------------------------------------------------

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
