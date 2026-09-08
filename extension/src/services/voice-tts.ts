/**
 * Text-to-Speech Service using Web Speech API
 *
 * Free, browser-native text-to-speech
 * No external APIs or API keys required
 */

export interface VoiceTTSOptions {
  lang?: string;
  pitch?: number; // 0-2, default 1
  rate?: number; // 0.1-10, default 1
  volume?: number; // 0-1, default 1
  voice?: SpeechSynthesisVoice;
}

export class VoiceTTS {
  private synthesis: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;

  constructor() {
    this.synthesis = window.speechSynthesis;
  }

  /**
   * Check if Speech Synthesis is supported in this browser
   */
  static isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  /**
   * Get available voices
   * Note: May need to wait for voices to load
   */
  async getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      let voices = this.synthesis.getVoices();

      if (voices.length > 0) {
        resolve(voices);
      } else {
        // Voices may not be loaded yet
        this.synthesis.addEventListener('voiceschanged', () => {
          voices = this.synthesis.getVoices();
          resolve(voices);
        }, { once: true });
      }
    });
  }

  /**
   * Speak text using Web Speech API
   * @param text - Text to speak
   * @param options - Voice configuration options
   * @param onEnd - Callback when speech finishes
   * @param onError - Callback on error
   */
  speak(
    text: string,
    options: VoiceTTSOptions = {},
    onEnd?: () => void,
    onError?: (error: string) => void
  ): void {
    if (!VoiceTTS.isSupported()) {
      onError?.('Text-to-speech is not supported in this browser');
      return;
    }

    // Cancel any ongoing speech
    if (this.isSpeaking) {
      this.stop();
    }

    // Create utterance
    this.currentUtterance = new SpeechSynthesisUtterance(text);

    // Configure utterance
    this.currentUtterance.lang = options.lang ?? 'en-US';
    this.currentUtterance.pitch = options.pitch ?? 1;
    this.currentUtterance.rate = options.rate ?? 1;
    this.currentUtterance.volume = options.volume ?? 1;

    if (options.voice) {
      this.currentUtterance.voice = options.voice;
    }

    // Handle events
    this.currentUtterance.onstart = () => {
      this.isSpeaking = true;
    };

    this.currentUtterance.onend = () => {
      this.isSpeaking = false;
      onEnd?.();
    };

    this.currentUtterance.onerror = (event) => {
      this.isSpeaking = false;
      console.error('Speech synthesis error:', event.error);
      onError?.(event.error || 'Speech synthesis failed');
    };

    // Speak
    this.synthesis.speak(this.currentUtterance);
  }

  /**
   * Stop current speech
   */
  stop(): void {
    if (this.isSpeaking) {
      this.synthesis.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }

  /**
   * Pause current speech
   */
  pause(): void {
    if (this.isSpeaking && !this.synthesis.paused) {
      this.synthesis.pause();
    }
  }

  /**
   * Resume paused speech
   */
  resume(): void {
    if (this.isSpeaking && this.synthesis.paused) {
      this.synthesis.resume();
    }
  }

  /**
   * Get current speaking state
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Get paused state
   */
  getIsPaused(): boolean {
    return this.synthesis.paused;
  }
}
