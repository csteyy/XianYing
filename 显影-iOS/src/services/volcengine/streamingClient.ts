import { generateConnectId } from './config';
import { encodeFullClientRequest, encodeAudioRequest, decodeServerFrame } from './protocol';
import type { StreamingASRConfig, StreamingASREvents, ServerError } from './types';
import { createASRWebSocket, WS_OPEN, type WebSocketLike } from '../platform';

export class StreamingASRClient {
  private ws: WebSocketLike | null = null;
  private events: Partial<StreamingASREvents> = {};
  private connectId: string;
  private _isConnected = false;

  constructor() {
    this.connectId = generateConnectId();
  }

  get isConnected() {
    return this._isConnected;
  }

  on<K extends keyof StreamingASREvents>(event: K, handler: StreamingASREvents[K]) {
    this.events[event] = handler;
  }

  connect(configOverrides?: Partial<StreamingASRConfig>): void {
    this.connectId = generateConnectId();
    this.ws = createASRWebSocket(this.connectId);

    this.ws.onopen = () => {
      this._isConnected = true;
      this.events.onOpen?.();
      this.sendConfig(configOverrides);
    };

    this.ws.onmessage = (event) => {
      try {
        const frame = decodeServerFrame(event.data as ArrayBuffer);
        if (frame.type === 'response') {
          if (frame.data.payload) {
            this.events.onResult?.(frame.data.payload);
          }
        } else if (frame.type === 'error') {
          this.events.onError?.(frame.data);
        }
      } catch (err) {
        console.error('[StreamingASR] Failed to decode frame:', err);
      }
    };

    this.ws.onclose = () => {
      this._isConnected = false;
      this.events.onClose?.();
    };

    this.ws.onerror = (ev: Event) => {
      const msg = (ev instanceof ErrorEvent && ev.message)
        ? ev.message
        : 'WebSocket connection error';
      this.events.onError?.({ code: -1, message: msg });
    };
  }

  private sendConfig(overrides?: Partial<StreamingASRConfig>) {
    const config: StreamingASRConfig = {
      audio: {
        format: 'pcm',
        rate: 16000,
        bits: 16,
        channel: 1,
        codec: 'raw',
        ...overrides?.audio,
      },
      request: {
        model_name: 'bigmodel',
        enable_itn: true,
        enable_punc: true,
        enable_ddc: false,
        enable_speaker_info: true,
        show_utterances: true,
        result_type: 'full',
        ...overrides?.request,
      },
      ...overrides?.user ? { user: overrides.user } : {},
    };

    const frame = encodeFullClientRequest(config);
    this.ws?.send(frame);
  }

  sendAudio(pcmData: ArrayBuffer, isLast = false): void {
    if (!this.ws || this.ws.readyState !== WS_OPEN) return;
    const frame = encodeAudioRequest(pcmData, isLast);
    this.ws.send(frame);
  }

  sendLastPacket(): void {
    if (!this.ws || this.ws.readyState !== WS_OPEN) return;
    const emptyPcm = new ArrayBuffer(0);
    const frame = encodeAudioRequest(emptyPcm, true);
    this.ws.send(frame);
  }

  disconnect(): void {
    if (this.ws) {
      if (this.ws.readyState === WS_OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
    this._isConnected = false;
  }
}
