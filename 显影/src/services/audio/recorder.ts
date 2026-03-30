/**
 * Real audio capture service using AudioContext + AudioWorklet.
 * Outputs PCM s16le 16kHz mono in ~200ms chunks,
 * plus real-time volume levels via AnalyserNode.
 */

export type PCMChunkHandler = (chunk: ArrayBuffer) => void;
export type VolumeHandler = (volume: number) => void;

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private volumeInterval: ReturnType<typeof setInterval> | null = null;

  private _onPCMChunk: PCMChunkHandler | null = null;
  private _onVolume: VolumeHandler | null = null;
  private _isRecording = false;
  private _allChunks: ArrayBuffer[] = [];

  get isRecording() {
    return this._isRecording;
  }

  /**
   * Get all recorded PCM chunks concatenated into a single ArrayBuffer.
   */
  get fullRecording(): ArrayBuffer {
    const totalLen = this._allChunks.reduce((sum, c) => sum + c.byteLength, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of this._allChunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    return result.buffer;
  }

  onPCMChunk(handler: PCMChunkHandler) {
    this._onPCMChunk = handler;
  }

  onVolume(handler: VolumeHandler) {
    this._onVolume = handler;
  }

  async start(): Promise<void> {
    this._allChunks = [];

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

    // AnalyserNode for volume metering
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.sourceNode.connect(this.analyserNode);

    // Start volume polling
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.volumeInterval = setInterval(() => {
      if (!this.analyserNode || !this._isRecording) return;
      this.analyserNode.getByteFrequencyData(dataArray);
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const avg = sum / dataArray.length;
      // Normalize to 0-100 range
      const volume = Math.min(100, (avg / 128) * 100);
      this._onVolume?.(volume);
    }, 50);

    // AudioWorklet for PCM conversion
    const workletUrl = new URL('/pcm-worklet-processor.js', window.location.origin);
    await this.audioContext.audioWorklet.addModule(workletUrl.href);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-worklet-processor');

    this.workletNode.port.onmessage = (event) => {
      if (event.data.type === 'pcmChunk' && this._isRecording) {
        const chunkCopy = event.data.buffer.slice(0);
        this._allChunks.push(chunkCopy);
        this._onPCMChunk?.(event.data.buffer);
      }
    };

    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);

    this._isRecording = true;
  }

  pause(): void {
    this._isRecording = false;
    if (this.audioContext?.state === 'running') {
      this.audioContext.suspend();
    }
  }

  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
    this._isRecording = true;
  }

  /**
   * Stop recording and release all resources.
   * Returns the full recorded audio as a WAV ArrayBuffer.
   */
  stop(): ArrayBuffer {
    this._isRecording = false;

    // Flush remaining samples from worklet
    this.workletNode?.port.postMessage({ type: 'flush' });

    if (this.volumeInterval) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = null;
    }

    this.workletNode?.disconnect();
    this.sourceNode?.disconnect();
    this.analyserNode?.disconnect();

    this.stream?.getTracks().forEach((t) => t.stop());

    const wavBuffer = this.pcmToWav(this.fullRecording, 16000);

    if (this.audioContext?.state !== 'closed') {
      this.audioContext?.close();
    }

    this.audioContext = null;
    this.stream = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.analyserNode = null;

    return wavBuffer;
  }

  /**
   * Wrap raw PCM s16le data in a WAV container.
   */
  private pcmToWav(pcmBuffer: ArrayBuffer, sampleRate: number): ArrayBuffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmBuffer.byteLength;
    const headerSize = 44;

    const wav = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(wav);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM subchunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    new Uint8Array(wav, headerSize).set(new Uint8Array(pcmBuffer));

    return wav;
  }
}
