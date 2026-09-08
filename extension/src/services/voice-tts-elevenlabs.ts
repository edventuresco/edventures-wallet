/**
 * ElevenLabs Text-to-Speech Service
 *
 * Cloud-based high-quality text-to-speech using ElevenLabs API
 * VoiceId: 8DzKSPdgEQPaK5vKG0Rs (publicly trackable, non-secret)
 */

export interface ElevenLabsTTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number; // 0-1, default 0.5
  similarityBoost?: number; // 0-1, default 0.75
  style?: number; // 0-1, default 0 (only for v2 models)
  useSpeakerBoost?: boolean; // default true
}

export class ElevenLabsTTS {
  private apiKey: string;
  // Hardcoded voiceId - publicly trackable, not a secret
  private readonly VOICE_ID: string = '8DzKSPdgEQPaK5vKG0Rs';
  private defaultModelId: string = 'eleven_multilingual_v2';
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isSpeaking = false;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.VITE_ELEVENLABS_API_KEY || '';

    // Initialize audio context
    if (typeof AudioContext !== 'undefined') {
      this.audioContext = new AudioContext();
    } else if (typeof (window as any).webkitAudioContext !== 'undefined') {
      this.audioContext = new (window as any).webkitAudioContext();
    }
  }

  /**
   * Check if ElevenLabs TTS is configured (has API key)
   */
  static isConfigured(): boolean {
    // Always return true - we'll try to use it and fail gracefully if no API key
    return true;
  }

  /**
   * Check if browser supports audio playback
   */
  static isSupported(): boolean {
    return typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined';
  }

  /**
   * Speak text using ElevenLabs API
   * @param text - Text to speak
   * @param options - Voice configuration options
   * @param onEnd - Callback when speech finishes
   * @param onError - Callback on error
   */
  async speak(
    text: string,
    options: ElevenLabsTTSOptions = {},
    onEnd?: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    if (!this.apiKey) {
      onError?.('ElevenLabs API key not configured');
      return;
    }

    if (!this.audioContext) {
      onError?.('Audio playback not supported in this browser');
      return;
    }

    // Stop any ongoing speech
    if (this.isSpeaking) {
      this.stop();
    }

    try {
      // Always use the hardcoded voiceId unless explicitly overridden
      const voiceId = options.voiceId || this.VOICE_ID;
      const modelId = options.modelId || this.defaultModelId;

      // Build request body
      const requestBody = {
        text,
        model_id: modelId,
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarityBoost ?? 0.75,
          style: options.style ?? 0,
          use_speaker_boost: options.useSpeakerBoost ?? true,
        },
      };

      // Call ElevenLabs API
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      // Get audio data
      const audioData = await response.arrayBuffer();

      // Decode and play audio
      await this.playAudio(audioData, onEnd, onError);

    } catch (error: any) {
      console.error('ElevenLabs TTS error:', error);
      onError?.(error.message || 'Failed to generate speech');
    }
  }

  /**
   * Play audio buffer
   */
  private async playAudio(
    audioData: ArrayBuffer,
    onEnd?: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    if (!this.audioContext) {
      onError?.('Audio context not available');
      return;
    }

    try {
      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(audioData);

      // Create audio source
      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = audioBuffer;
      this.currentSource.connect(this.audioContext.destination);

      // Set up event handlers
      this.currentSource.onended = () => {
        this.isSpeaking = false;
        this.currentSource = null;
        onEnd?.();
      };

      // Start playback
      this.isSpeaking = true;
      this.currentSource.start(0);

    } catch (error: any) {
      console.error('Audio playback error:', error);
      this.isSpeaking = false;
      onError?.(error.message || 'Audio playback failed');
    }
  }

  /**
   * Stop current speech
   */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (error) {
        console.error('Error stopping audio:', error);
      }
      this.currentSource = null;
    }
    this.isSpeaking = false;
  }

  /**
   * Get current speaking state
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Get the hardcoded voiceId
   * VoiceId: 8DzKSPdgEQPaK5vKG0Rs (publicly trackable, not a secret)
   */
  getConfiguredVoiceId(): string {
    return this.VOICE_ID;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
  }
}
