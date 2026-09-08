/**
 * Audio Capture Pipeline with Acoustic Echo Cancellation
 *
 * Captures microphone audio with echo cancellation enabled to prevent feedback loops
 * Converts audio to PCM format suitable for streaming to ElevenLabs
 */

export interface AudioCaptureOptions {
  sampleRate?: number; // Default: 16000 (16kHz)
  channelCount?: number; // Default: 1 (mono)
  echoCancellation?: boolean; // Default: true
  noiseSuppression?: boolean; // Default: true
  autoGainControl?: boolean; // Default: true
}

export interface AudioChunk {
  data: Float32Array;
  sampleRate: number;
  timestamp: number;
}

export class AudioCapture {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isCapturing = false;
  private onAudioChunk: ((chunk: AudioChunk) => void) | null = null;

  /**
   * Start capturing audio from microphone
   */
  async startCapture(
    onAudioChunk: (chunk: AudioChunk) => void,
    options: AudioCaptureOptions = {}
  ): Promise<void> {
    if (this.isCapturing) {
      console.warn('Audio capture already running');
      return;
    }

    const {
      sampleRate = 16000,
      channelCount = 1,
      echoCancellation = true,
      noiseSuppression = true,
      autoGainControl = true,
    } = options;

    this.onAudioChunk = onAudioChunk;

    try {
      // Request microphone with AEC and other enhancements
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation,
          noiseSuppression,
          autoGainControl,
          sampleRate,
          channelCount,
        },
      });

      // Create audio context
      this.audioContext = new AudioContext({ sampleRate });

      // Create source node from stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

      // Create processor node for audio chunks
      // Note: ScriptProcessorNode is deprecated but still widely supported
      // TODO: Migrate to AudioWorklet for better performance
      const bufferSize = 4096; // ~256ms at 16kHz
      this.processorNode = this.audioContext.createScriptProcessor(
        bufferSize,
        channelCount,
        channelCount
      );

      // Process audio chunks
      this.processorNode.onaudioprocess = (event) => {
        if (!this.isCapturing) return;

        const inputBuffer = event.inputBuffer;
        const channelData = inputBuffer.getChannelData(0); // Get mono channel

        const chunk: AudioChunk = {
          data: new Float32Array(channelData),
          sampleRate: inputBuffer.sampleRate,
          timestamp: Date.now(),
        };

        this.onAudioChunk?.(chunk);
      };

      // Connect nodes
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.isCapturing = true;
      console.log('Audio capture started with AEC enabled');
    } catch (error: any) {
      console.error('Failed to start audio capture:', error);
      throw new Error(`Audio capture failed: ${error.message}`);
    }
  }

  /**
   * Stop capturing audio
   */
  stopCapture(): void {
    if (!this.isCapturing) return;

    // Disconnect nodes
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Stop media stream
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.isCapturing = false;
    this.onAudioChunk = null;
    console.log('Audio capture stopped');
  }

  /**
   * Check if currently capturing
   */
  getIsCapturing(): boolean {
    return this.isCapturing;
  }

  /**
   * Convert Float32Array to base64-encoded PCM16
   * ElevenLabs expects PCM16 (16-bit signed integers)
   */
  static float32ToPCM16Base64(float32Array: Float32Array): string {
    const pcm16 = new Int16Array(float32Array.length);

    for (let i = 0; i < float32Array.length; i++) {
      // Convert float (-1.0 to 1.0) to int16 (-32768 to 32767)
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Convert to base64
    const bytes = new Uint8Array(pcm16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Calculate audio energy (volume level)
   * Useful for barge-in detection
   */
  static calculateEnergy(float32Array: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < float32Array.length; i++) {
      sum += float32Array[i] * float32Array[i];
    }
    return Math.sqrt(sum / float32Array.length);
  }

  /**
   * Detect if audio chunk contains speech
   * Simple energy-based voice activity detection (VAD)
   */
  static detectVoiceActivity(float32Array: Float32Array, threshold = 0.02): boolean {
    const energy = AudioCapture.calculateEnergy(float32Array);
    return energy > threshold;
  }
}
