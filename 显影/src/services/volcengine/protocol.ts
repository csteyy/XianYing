import pako from 'pako';
import {
  MessageType,
  MessageFlags,
  SerializationMethod,
  CompressionMethod,
  type ProtocolHeader,
  type ServerResponse,
  type ServerError,
  type ASRResult,
  type StreamingASRConfig,
} from './types';

const PROTOCOL_VERSION = 0b0001;
const HEADER_SIZE = 0b0001; // 1 * 4 = 4 bytes

// --- Encoding ---

function buildHeader(
  messageType: MessageType,
  flags: MessageFlags,
  serialization: SerializationMethod,
  compression: CompressionMethod,
): Uint8Array {
  const header = new Uint8Array(4);
  header[0] = (PROTOCOL_VERSION << 4) | HEADER_SIZE;
  header[1] = (messageType << 4) | flags;
  header[2] = (serialization << 4) | compression;
  header[3] = 0x00;
  return header;
}

function encodePayloadSize(size: number): Uint8Array {
  const buf = new Uint8Array(4);
  const view = new DataView(buf.buffer);
  view.setUint32(0, size, false); // big-endian
  return buf;
}

function compressPayload(data: Uint8Array, compression: CompressionMethod): Uint8Array {
  if (compression === CompressionMethod.Gzip) {
    return pako.gzip(data);
  }
  return data;
}

/**
 * Build the initial full client request frame.
 * header(4) + payloadSize(4) + gzipped JSON payload
 */
export function encodeFullClientRequest(config: StreamingASRConfig): ArrayBuffer {
  const jsonStr = JSON.stringify(config);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const compressed = compressPayload(jsonBytes, CompressionMethod.Gzip);

  const header = buildHeader(
    MessageType.FullClientRequest,
    MessageFlags.None,
    SerializationMethod.JSON,
    CompressionMethod.Gzip,
  );
  const sizeBytes = encodePayloadSize(compressed.length);

  const frame = new Uint8Array(4 + 4 + compressed.length);
  frame.set(header, 0);
  frame.set(sizeBytes, 4);
  frame.set(compressed, 8);
  return frame.buffer;
}

/**
 * Build an audio-only request frame.
 * header(4) + payloadSize(4) + gzipped audio data
 */
export function encodeAudioRequest(pcmData: ArrayBuffer, isLast: boolean): ArrayBuffer {
  const audioBytes = new Uint8Array(pcmData);
  const compressed = compressPayload(audioBytes, CompressionMethod.Gzip);

  const flags = isLast ? MessageFlags.LastPacketNoSequence : MessageFlags.None;
  const header = buildHeader(
    MessageType.AudioOnlyRequest,
    flags,
    SerializationMethod.None,
    CompressionMethod.Gzip,
  );
  const sizeBytes = encodePayloadSize(compressed.length);

  const frame = new Uint8Array(4 + 4 + compressed.length);
  frame.set(header, 0);
  frame.set(sizeBytes, 4);
  frame.set(compressed, 8);
  return frame.buffer;
}

// --- Decoding ---

function parseHeader(data: Uint8Array): ProtocolHeader {
  return {
    version: (data[0] >> 4) & 0x0f,
    headerSize: (data[0] & 0x0f) * 4,
    messageType: ((data[1] >> 4) & 0x0f) as MessageType,
    flags: (data[1] & 0x0f) as MessageFlags,
    serialization: ((data[2] >> 4) & 0x0f) as SerializationMethod,
    compression: (data[2] & 0x0f) as CompressionMethod,
  };
}

function decompressPayload(data: Uint8Array, compression: CompressionMethod): Uint8Array {
  if (compression === CompressionMethod.Gzip) {
    return pako.ungzip(data);
  }
  return data;
}

/**
 * Decode a server response frame. Returns either a normal response or an error.
 */
export function decodeServerFrame(
  data: ArrayBuffer,
): { type: 'response'; data: ServerResponse } | { type: 'error'; data: ServerError } {
  const bytes = new Uint8Array(data);
  const header = parseHeader(bytes);

  if (header.messageType === MessageType.ErrorResponse) {
    return decodeErrorFrame(bytes, header);
  }

  if (header.messageType === MessageType.FullServerResponse) {
    return decodeResponseFrame(bytes, header);
  }

  throw new Error(`Unknown message type: ${header.messageType}`);
}

function decodeResponseFrame(
  bytes: Uint8Array,
  header: ProtocolHeader,
): { type: 'response'; data: ServerResponse } {
  const headerLen = header.headerSize;
  let offset = headerLen;

  // sequence number (4 bytes) present when flags indicate it
  let sequence = 0;
  const hasSequence =
    header.flags === MessageFlags.HasPositiveSequence ||
    header.flags === MessageFlags.LastPacketWithSequence;

  if (hasSequence) {
    const seqView = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
    sequence = seqView.getInt32(0, false);
    offset += 4;
  }

  // payload size (4 bytes, big-endian)
  const sizeView = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
  const payloadSize = sizeView.getUint32(0, false);
  offset += 4;

  let payload: ASRResult | null = null;
  if (payloadSize > 0) {
    const compressedPayload = bytes.slice(offset, offset + payloadSize);
    const decompressed = decompressPayload(compressedPayload, header.compression);
    const jsonStr = new TextDecoder().decode(decompressed);
    payload = JSON.parse(jsonStr) as ASRResult;
  }

  const isLast =
    header.flags === MessageFlags.LastPacketNoSequence ||
    header.flags === MessageFlags.LastPacketWithSequence;

  return { type: 'response', data: { sequence, payload, isLast } };
}

function decodeErrorFrame(
  bytes: Uint8Array,
  header: ProtocolHeader,
): { type: 'error'; data: ServerError } {
  const headerLen = header.headerSize;
  let offset = headerLen;

  // error code (4 bytes, big-endian)
  const codeView = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
  const code = codeView.getUint32(0, false);
  offset += 4;

  // error message size (4 bytes)
  const msgSizeView = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
  const msgSize = msgSizeView.getUint32(0, false);
  offset += 4;

  // error message (UTF-8 string)
  const msgBytes = bytes.slice(offset, offset + msgSize);
  const message = new TextDecoder().decode(msgBytes);

  return { type: 'error', data: { code, message } };
}
