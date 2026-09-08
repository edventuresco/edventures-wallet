/**
 * Speech-to-Text Service using Web Speech API
 *
 * Free, browser-native speech recognition
 * No external APIs or API keys required
 */

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new(): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new(): SpeechRecognition;
    };
  }
}

export interface VoiceSTTOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export class VoiceSTT {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;

  /**
   * Check if Speech Recognition is supported in this browser
   */
  static isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  /**
   * Start listening for voice input
   * @param onResult - Callback when transcript is received
   * @param onError - Callback when error occurs
   * @param options - Configuration options
   */
  startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError?: (error: string) => void,
    options: VoiceSTTOptions = {}
  ): void {
    if (!VoiceSTT.isSupported()) {
      onError?.('Speech recognition is not supported in this browser');
      return;
    }

    if (this.isListening) {
      console.warn('Already listening');
      return;
    }

    // Create recognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configure recognition
    this.recognition.continuous = options.continuous ?? false;
    this.recognition.interimResults = options.interimResults ?? false;
    this.recognition.lang = options.language ?? 'en-US';
    this.recognition.maxAlternatives = 1;

    // Handle results
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex];
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;

      onResult(transcript, isFinal);
    };

    // Handle errors
    this.recognition.onerror = (event: any) => {
      const errorMessage = event.error || 'Unknown error';
      console.error('Speech recognition error:', errorMessage);
      onError?.(errorMessage);
      this.isListening = false;
    };

    // Handle end
    this.recognition.onend = () => {
      this.isListening = false;
    };

    // Handle start
    this.recognition.onstart = () => {
      this.isListening = true;
    };

    // Start recognition
    try {
      this.recognition.start();
    } catch (error: any) {
      onError?.(error.message || 'Failed to start speech recognition');
      this.isListening = false;
    }
  }

  /**
   * Stop listening for voice input
   */
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  /**
   * Abort listening immediately
   */
  abort(): void {
    if (this.recognition && this.isListening) {
      this.recognition.abort();
      this.isListening = false;
    }
  }

  /**
   * Get current listening state
   */
  getIsListening(): boolean {
    return this.isListening;
  }
}
