// --- Binary protocol types ---

export const enum MessageType {
  FullClientRequest = 0b0001,
  AudioOnlyRequest = 0b0010,
  FullServerResponse = 0b1001,
  ErrorResponse = 0b1111,
}

export const enum MessageFlags {
  None = 0b0000,
  HasPositiveSequence = 0b0001,
  LastPacketNoSequence = 0b0010,
  LastPacketWithSequence = 0b0011,
}

export const enum SerializationMethod {
  None = 0b0000,
  JSON = 0b0001,
}

export const enum CompressionMethod {
  None = 0b0000,
  Gzip = 0b0001,
}

export interface ProtocolHeader {
  version: number;
  headerSize: number;
  messageType: MessageType;
  flags: MessageFlags;
  serialization: SerializationMethod;
  compression: CompressionMethod;
}

export interface ServerResponse {
  sequence: number;
  payload: ASRResult | null;
  isLast: boolean;
}

export interface ServerError {
  code: number;
  message: string;
}

// --- ASR request/response types ---

export interface StreamingASRConfig {
  user?: { uid?: string; did?: string; platform?: string };
  audio: {
    format: 'pcm' | 'wav' | 'ogg' | 'mp3';
    rate?: number;
    bits?: number;
    channel?: number;
    codec?: 'raw' | 'opus';
  };
  request: {
    model_name: 'bigmodel';
    enable_itn?: boolean;
    enable_punc?: boolean;
    enable_ddc?: boolean;
    enable_speaker_info?: boolean;
    enable_lid?: boolean;
    show_utterances?: boolean;
    result_type?: 'full' | 'single';
    enable_nonstream?: boolean;
    end_window_size?: number;
    vad_segment_duration?: number;
    corpus?: {
      boosting_table_name?: string;
      boosting_table_id?: string;
      context?: string;
    };
  };
}

export interface ASRUtterance {
  text: string;
  start_time: number;
  end_time: number;
  definite: boolean;
  words?: Array<{
    text: string;
    start_time: number;
    end_time: number;
    blank_duration: number;
  }>;
  additions?: Record<string, string>;
  speaker?: number;
  channel_id?: number;
}

export interface ASRResult {
  result?: {
    text: string;
    utterances?: ASRUtterance[];
  };
  audio_info?: {
    duration: number;
  };
}

// --- File recognition types ---

export interface FileASRSubmitConfig {
  user?: { uid?: string };
  audio: {
    url: string;
    format: 'raw' | 'wav' | 'mp3' | 'ogg';
    codec?: 'raw' | 'opus';
    rate?: number;
    bits?: number;
    channel?: number;
    language?: string;
  };
  request: {
    model_name: 'bigmodel';
    model_version?: string;
    ssd_version?: string;
    enable_itn?: boolean;
    enable_punc?: boolean;
    enable_ddc?: boolean;
    enable_speaker_info?: boolean;
    enable_emotion_detection?: boolean;
    enable_gender_detection?: boolean;
    enable_lid?: boolean;
    show_utterances?: boolean;
    show_speech_rate?: boolean;
    show_volume?: boolean;
    enable_channel_split?: boolean;
    end_window_size?: number;
    corpus?: {
      boosting_table_name?: string;
      context?: string;
    };
  };
  callback?: string;
  callback_data?: string;
}

export const ASR_ERROR_CODES: Record<number, string> = {
  20000000: '成功',
  20000001: '正在处理中',
  20000002: '任务在队列中',
  20000003: '静音音频',
  45000001: '请求参数无效',
  45000002: '空音频',
  45000081: '等包超时',
  45000151: '音频格式不正确',
  55000031: '服务器繁忙',
};

// --- Streaming client events ---

export interface StreamingASREvents {
  onResult: (result: ASRResult) => void;
  onError: (error: ServerError) => void;
  onOpen: () => void;
  onClose: () => void;
}
