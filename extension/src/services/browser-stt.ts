/**
 * Browser Speech-to-Text Service
 *
 * Uses Web Speech API (SpeechRecognition) for speech-to-text
 * Simpler alternative to ElevenLabs ConvAI that doesn't require agent setup
 */

export interface BrowserSTTConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface TranscriptEvent {
  type: 'partial' | 'final';
  text: string;
  confidence?: number;
  timestamp: number;
}

export interface BrowserSTTCallbacks {
  onTranscript?: (event: TranscriptEvent) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * Browser-based Speech Recognition using Web Speech API
 */
export class BrowserSTT {
  private recognition: any = null;
  private config: BrowserSTTConfig;
  private callbacks: BrowserSTTCallbacks;
  private isListening = false;

  constructor(config: BrowserSTTConfig = {}, callbacks: BrowserSTTCallbacks = {}) {
    this.config = {
      language: config.language || 'en-US',
      continuous: config.continuous ?? true,
      interimResults: config.interimResults ?? true,
      maxAlternatives: config.maxAlternatives || 1,
    };
    this.callbacks = callbacks;
  }

  /**
   * Check if browser supports Speech Recognition
   */
  static isSupported(): boolean {
    return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
  }

  /**
   * Initialize speech recognition
   */
  init(): void {
    if (!BrowserSTT.isSupported()) {
      const error = 'Speech Recognition not supported in this browser';
      console.error(error);
      this.callbacks.onError?.(error);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configure recognition
    this.recognition.lang = this.config.language;
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.maxAlternatives = this.config.maxAlternatives;

    // Set up event handlers
    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('Browser STT started');
      this.callbacks.onStart?.();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('Browser STT ended');
      this.callbacks.onEnd?.();

      // Auto-restart if continuous mode
      if (this.config.continuous && this.isListening) {
        setTimeout(() => {
          if (this.isListening) {
            this.start();
          }
        }, 100);
      }
    };

    this.recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      const isFinal = result.isFinal;

      this.callbacks.onTranscript?.({
        type: isFinal ? 'final' : 'partial',
        text: transcript,
        confidence,
        timestamp: Date.now(),
      });
    };

    this.recognition.onerror = (event: any) => {
      console.error('Browser STT error:', event.error);
      this.callbacks.onError?.(event.error);
    };
  }

  /**
   * Start listening
   */
  start(): void {
    if (!this.recognition) {
      this.init();
    }

    if (this.isListening) {
      console.warn('Already listening');
      return;
    }

    try {
      this.recognition.start();
    } catch (error: any) {
      console.error('Failed to start STT:', error);
      this.callbacks.onError?.(error.message);
    }
  }

  /**
   * Stop listening
   */
  stop(): void {
    if (!this.isListening || !this.recognition) {
      return;
    }

    try {
      this.recognition.stop();
    } catch (error: any) {
      console.error('Failed to stop STT:', error);
    }
  }

  /**
   * Get listening state
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop();
    this.recognition = null;
  }
}
