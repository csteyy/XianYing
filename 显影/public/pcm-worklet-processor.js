/**
 * AudioWorkletProcessor that converts float32 audio samples to Int16 PCM
 * and buffers them into ~200ms chunks for streaming ASR.
 *
 * Posts messages: { type: 'pcmChunk', buffer: Int16Array.buffer }
 * Receives messages: { type: 'flush' } to force-send remaining buffer
 */
class PCMWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 16kHz * 0.2s = 3200 samples per 200ms chunk
    this.CHUNK_SIZE = 3200;
    this.buffer = new Int16Array(this.CHUNK_SIZE);
    this.bufferOffset = 0;

    this.port.onmessage = (event) => {
      if (event.data.type === 'flush') {
        this._flushBuffer();
      }
    };
  }

  _flushBuffer() {
    if (this.bufferOffset > 0) {
      const chunk = this.buffer.slice(0, this.bufferOffset);
      this.port.postMessage({ type: 'pcmChunk', buffer: chunk.buffer }, [chunk.buffer]);
      this.buffer = new Int16Array(this.CHUNK_SIZE);
      this.bufferOffset = 0;
    }
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0]; // mono
    if (!channelData) return true;

    for (let i = 0; i < channelData.length; i++) {
      // float32 [-1, 1] → int16 [-32768, 32767]
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      this.buffer[this.bufferOffset++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

      if (this.bufferOffset >= this.CHUNK_SIZE) {
        const chunk = this.buffer;
        this.port.postMessage({ type: 'pcmChunk', buffer: chunk.buffer }, [chunk.buffer]);
        this.buffer = new Int16Array(this.CHUNK_SIZE);
        this.bufferOffset = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-worklet-processor', PCMWorkletProcessor);
