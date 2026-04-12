/**
 * AudioWorkletProcessor that converts float32 audio to Int16 PCM 16kHz mono.
 *
 * Handles resampling when the AudioContext sample rate differs from the
 * target 16kHz (common on iOS where 48kHz is forced). Uses linear
 * interpolation with a fractional accumulator for sample-accurate output.
 *
 * Messages received:
 *   { type: 'init', sampleRate: number, targetRate: number }
 *   { type: 'flush' }
 *
 * Messages posted:
 *   { type: 'pcmChunk', buffer: Int16Array.buffer }
 */
class PCMWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sourceRate = 16000;
    this.targetRate = 16000;
    this.resampleRatio = 1;
    this.resamplePos = 0;
    this.prevSample = 0;

    // 16kHz * 0.2s = 3200 samples per ~200ms chunk
    this.CHUNK_SIZE = 3200;
    this.buffer = new Int16Array(this.CHUNK_SIZE);
    this.bufferOffset = 0;

    this.port.onmessage = (event) => {
      if (event.data.type === 'init') {
        this.sourceRate = event.data.sampleRate || 16000;
        this.targetRate = event.data.targetRate || 16000;
        this.resampleRatio = this.sourceRate / this.targetRate;
        this.resamplePos = 0;
        this.prevSample = 0;
      } else if (event.data.type === 'flush') {
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

  _pushSample(floatSample) {
    const clamped = Math.max(-1, Math.min(1, floatSample));
    this.buffer[this.bufferOffset++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

    if (this.bufferOffset >= this.CHUNK_SIZE) {
      const chunk = this.buffer;
      this.port.postMessage({ type: 'pcmChunk', buffer: chunk.buffer }, [chunk.buffer]);
      this.buffer = new Int16Array(this.CHUNK_SIZE);
      this.bufferOffset = 0;
    }
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData) return true;

    if (this.sourceRate === this.targetRate) {
      for (let i = 0; i < channelData.length; i++) {
        this._pushSample(channelData[i]);
      }
    } else {
      // Resample from sourceRate to targetRate using linear interpolation.
      // resamplePos tracks our position in the source sample stream as a
      // fractional index. For each input sample we advance resamplePos by 1
      // and emit output samples whenever resamplePos crosses a ratio boundary.
      for (let i = 0; i < channelData.length; i++) {
        const cur = channelData[i];

        while (this.resamplePos < 1) {
          const frac = this.resamplePos;
          const interpolated = this.prevSample + frac * (cur - this.prevSample);
          this._pushSample(interpolated);
          this.resamplePos += this.resampleRatio;
        }
        this.resamplePos -= 1;
        this.prevSample = cur;
      }
    }

    return true;
  }
}

registerProcessor('pcm-worklet-processor', PCMWorkletProcessor);
