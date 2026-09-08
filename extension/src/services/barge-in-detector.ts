/**
 * Barge-In Detector
 *
 * Detects when user starts speaking while AI is talking
 * Uses voice activity detection and transcript analysis
 */

import { AudioCapture } from './audio-capture';
import { TranscriptEvent } from './elevenlabs-realtime';

export interface BargeInConfig {
  energyThreshold?: number; // Voice energy threshold (0.0-1.0)
  minTranscriptLength?: number; // Minimum chars before triggering
  debounceMs?: number; // Debounce window to prevent false positives
  vadWindowMs?: number; // Voice activity detection window
}

export interface BargeInEvent {
  timestamp: number;
  reason: 'energy' | 'transcript' | 'combined';
  confidence: number;
  details?: {
    energy?: number;
    transcriptLength?: number;
  };
}

export class BargeInDetector {
  private config: BargeInConfig;
  private lastBargeIn: number = 0;
  private energyHistory: number[] = [];
  private vadWindowSize: number;
  private partialTranscript = '';
  private onBargeIn: ((event: BargeInEvent) => void) | null = null;

  constructor(config: BargeInConfig = {}) {
    this.config = {
      energyThreshold: config.energyThreshold ?? 0.02,
      minTranscriptLength: config.minTranscriptLength ?? 3,
      debounceMs: config.debounceMs ?? 300,
      vadWindowMs: config.vadWindowMs ?? 200,
    };

    // Calculate VAD window size based on sample rate
    // Assuming 16kHz sample rate and 4096 buffer size = ~256ms per chunk
    this.vadWindowSize = Math.ceil((this.config.vadWindowMs ?? 200) / 256);
  }

  /**
   * Set barge-in callback
   */
  setBargeInCallback(callback: (event: BargeInEvent) => void): void {
    this.onBargeIn = callback;
  }

  /**
   * Process audio chunk for barge-in detection
   * Should be called continuously while AI is speaking
   */
  processAudioChunk(audioData: Float32Array): void {
    const energy = AudioCapture.calculateEnergy(audioData);
    this.energyHistory.push(energy);

    // Keep window size limited
    if (this.energyHistory.length > this.vadWindowSize) {
      this.energyHistory.shift();
    }

    // Check if energy threshold exceeded in recent window
    const avgEnergy = this.getAverageEnergy();
    const hasVoiceActivity = avgEnergy > (this.config.energyThreshold ?? 0.02);

    if (hasVoiceActivity) {
      this.triggerBargeIn({
        timestamp: Date.now(),
        reason: 'energy',
        confidence: this.calculateConfidence(avgEnergy),
        details: {
          energy: avgEnergy,
        },
      });
    }
  }

  /**
   * Process transcript for barge-in detection
   * Should be called when partial transcripts are received
   */
  processTranscript(event: TranscriptEvent): void {
    if (event.type === 'partial') {
      this.partialTranscript = event.text;

      // Check if transcript exceeds minimum length
      const length = event.text.trim().length;
      if (length >= (this.config.minTranscriptLength ?? 3)) {
        this.triggerBargeIn({
          timestamp: Date.now(),
          reason: 'transcript',
          confidence: event.confidence ?? 0.8,
          details: {
            transcriptLength: length,
          },
        });
      }
    } else if (event.type === 'final') {
      // Clear partial transcript on final
      this.partialTranscript = '';
    }
  }

  /**
   * Process combined audio + transcript for higher confidence
   */
  processCombined(audioData: Float32Array, transcript: TranscriptEvent): void {
    const energy = AudioCapture.calculateEnergy(audioData);
    const hasVoiceActivity = energy > (this.config.energyThreshold ?? 0.02);
    const hasTranscript = transcript.text.trim().length >= (this.config.minTranscriptLength ?? 3);

    if (hasVoiceActivity && hasTranscript) {
      this.triggerBargeIn({
        timestamp: Date.now(),
        reason: 'combined',
        confidence: Math.min((transcript.confidence ?? 0.8) + 0.15, 1.0), // Boost confidence
        details: {
          energy,
          transcriptLength: transcript.text.length,
        },
      });
    }
  }

  /**
   * Trigger barge-in event with debouncing
   */
  private triggerBargeIn(event: BargeInEvent): void {
    const now = Date.now();
    const timeSinceLastBargeIn = now - this.lastBargeIn;

    // Debounce to prevent multiple rapid triggers
    if (timeSinceLastBargeIn < (this.config.debounceMs ?? 300)) {
      return;
    }

    this.lastBargeIn = now;

    // Trigger callback
    this.onBargeIn?.(event);
  }

  /**
   * Calculate average energy from recent history
   */
  private getAverageEnergy(): number {
    if (this.energyHistory.length === 0) return 0;

    const sum = this.energyHistory.reduce((acc, val) => acc + val, 0);
    return sum / this.energyHistory.length;
  }

  /**
   * Calculate confidence score based on energy level
   */
  private calculateConfidence(energy: number): number {
    const threshold = this.config.energyThreshold ?? 0.02;

    // Normalize energy to 0-1 confidence
    // Energy > 3x threshold = 100% confidence
    const normalized = Math.min(energy / (threshold * 3), 1.0);

    // Apply curve to favor stronger signals
    return Math.pow(normalized, 0.7);
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.energyHistory = [];
    this.partialTranscript = '';
  }

  /**
   * Get current partial transcript
   */
  getPartialTranscript(): string {
    return this.partialTranscript;
  }

  /**
   * Get current average energy
   */
  getCurrentEnergy(): number {
    return this.getAverageEnergy();
  }

  /**
   * Check if detector is active (has recent energy data)
   */
  isActive(): boolean {
    return this.energyHistory.length > 0;
  }
}
