/**
 * ElevenLabs Realtime Voice Service
 *
 * Provides full-duplex voice conversation using ElevenLabs Realtime API
 * Architecture: Separate WebSockets for STT and TTS with coordinated barge-in
 */

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId?: string;
  model?: string;
}

export interface TranscriptEvent {
  type: 'partial' | 'final';
  text: string;
  confidence?: number;
  timestamp: number;
}

export interface AudioEvent {
  type: 'audio';
  data: ArrayBuffer;
  timestamp: number;
}

export interface ElevenLabsCallbacks {
  onTranscript?: (event: TranscriptEvent) => void;
  onAudio?: (event: AudioEvent) => void;
  onError?: (error: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onPlaybackComplete?: () => void; // Called when all audio finishes playing
}

/**
 * ElevenLabs Realtime STT WebSocket Client
 */
export class ElevenLabsSTT {
  private ws: WebSocket | null = null;
  private config: ElevenLabsConfig;
  private callbacks: ElevenLabsCallbacks;
  private isConnected = false;

  constructor(config: ElevenLabsConfig, callbacks: ElevenLabsCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
  }

  /**
   * Connect to ElevenLabs Realtime STT WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.warn('STT already connected');
      return;
    }

    const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation/get_signed_url`;

    try {
      // Note: ElevenLabs requires getting a signed URL first via REST API
      // For now, using placeholder - need to implement proper auth flow
      const signedUrl = await this.getSignedUrl();

      this.ws = new WebSocket(signedUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('ElevenLabs STT connected');
        this.callbacks.onConnected?.();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('ElevenLabs STT error:', error);
        this.callbacks.onError?.('WebSocket error');
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.log('ElevenLabs STT disconnected');
        this.callbacks.onDisconnected?.();
      };
    } catch (error: any) {
      console.error('Failed to connect to ElevenLabs STT:', error);
      this.callbacks.onError?.(error.message);
      throw error;
    }
  }

  /**
   * Get signed WebSocket URL from ElevenLabs API
   * TODO: Implement proper REST API call
   */
  private async getSignedUrl(): Promise<string> {
    // This is a placeholder - actual implementation needs to call ElevenLabs REST API
    // POST https://api.elevenlabs.io/v1/convai/conversation/get_signed_url
    // with agent_id and API key
    throw new Error('getSignedUrl not implemented - needs ElevenLabs Agent Platform setup');
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string | ArrayBuffer): void {
    if (typeof data === 'string') {
      try {
        const message = JSON.parse(data);

        if (message.type === 'partial_transcript') {
          this.callbacks.onTranscript?.({
            type: 'partial',
            text: message.text || '',
            confidence: message.confidence,
            timestamp: Date.now(),
          });
        } else if (message.type === 'final_transcript') {
          this.callbacks.onTranscript?.({
            type: 'final',
            text: message.text || '',
            confidence: message.confidence,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error('Failed to parse STT message:', error);
      }
    }
  }

  /**
   * Send audio chunk to STT
   */
  sendAudio(audioBase64: string): void {
    if (!this.isConnected || !this.ws) {
      console.warn('STT not connected');
      return;
    }

    const message = {
      type: 'input_audio_chunk',
      audio: audioBase64,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Disconnect from STT
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }
}

/**
 * ElevenLabs Streaming TTS WebSocket Client
 */
export class ElevenLabsTTS {
  private ws: WebSocket | null = null;
  private config: ElevenLabsConfig;
  private callbacks: ElevenLabsCallbacks;
  private isConnected = false;
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;

  // Stream lock to prevent concurrent text streaming
  private streamLock = false;
  private streamLockTimestamp: number | null = null;

  // Track playback completion
  private totalExpectedDuration = 0;
  private playbackStartTime: number | null = null;
  private isStreamComplete = false;

  constructor(config: ElevenLabsConfig, callbacks: ElevenLabsCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
  }

  /**
   * Connect to ElevenLabs Streaming TTS WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.warn('TTS already connected');
      return;
    }

    const voiceId = this.config.voiceId || '21m00Tcm4TlvDq8ikWAM'; // Rachel
    const model = this.config.model || 'eleven_multilingual_v2';

    // ElevenLabs WebSocket streaming TTS endpoint
    const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${model}&optimize_streaming_latency=0`;

    console.log('[ElevenLabsTTS] Connecting to:', wsUrl);

    try {
      // Browser WebSocket doesn't support custom headers, so we need to use a different approach
      // For browser, we'll send API key in the first message
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('ElevenLabs TTS connected');

        // Send initial configuration
        this.sendConfig();

        this.callbacks.onConnected?.();
      };

      this.ws.onmessage = (event) => {
        console.log('[ElevenLabsTTS] Received message:', typeof event.data, event.data instanceof ArrayBuffer ? `ArrayBuffer(${event.data.byteLength} bytes)` : event.data.substring(0, 200));
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[ElevenLabsTTS] WebSocket error:', error);
        this.callbacks.onError?.('WebSocket error');
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        console.log(`[ElevenLabsTTS] WebSocket closed. Code: ${event.code}, Reason: ${event.reason || 'none'}, Clean: ${event.wasClean}`);

        // Distinguish between timeout and authentication failure (both use 1008)
        if (event.code === 1008 || event.code === 1002) {
          const reason = event.reason?.toLowerCase() || '';

          // Timeout is NOT an error - it's expected after 20s of no input
          if (reason.includes('timeout') || reason.includes('not received')) {
            console.log('[ElevenLabsTTS] Idle timeout - auto-reconnecting...');
            setTimeout(() => {
              if (!this.isConnected) {
                this.connect().catch(err => {
                  console.error('[ElevenLabsTTS] Auto-reconnect failed:', err);
                });
              }
            }, 100);
            return;
          }

          // Actual authentication failure
          console.error('[ElevenLabsTTS] Authentication failed - check API key');
          this.callbacks.onError?.('Authentication failed - invalid API key');
          this.callbacks.onDisconnected?.();
          return;
        }

        // Normal close (1000) happens after flush() - this is expected
        // Auto-reconnect for conversation continuity
        if (event.code === 1000 && event.wasClean) {
          console.log('[ElevenLabsTTS] Normal close after flush - auto-reconnecting for next response...');
          // Auto-reconnect after a short delay
          setTimeout(() => {
            if (!this.isConnected) {
              console.log('[ElevenLabsTTS] Auto-reconnecting...');
              this.connect().catch(err => {
                console.error('[ElevenLabsTTS] Auto-reconnect failed:', err);
              });
            }
          }, 100);
        } else if (!event.wasClean) {
          console.warn('[ElevenLabsTTS] Connection closed unexpectedly');
          this.callbacks.onError?.('Connection lost unexpectedly');
          this.callbacks.onDisconnected?.();
        }
      };

      // Initialize audio context
      this.audioContext = new AudioContext({ sampleRate: 24000 });

      // Resume AudioContext immediately if possible (requires user gesture)
      if (this.audioContext.state === 'suspended') {
        console.log('[ElevenLabsTTS] Attempting to resume AudioContext...');
        this.audioContext.resume().then(() => {
          console.log('[ElevenLabsTTS] AudioContext resumed successfully');
        }).catch((error) => {
          console.warn('[ElevenLabsTTS] Failed to resume AudioContext (user gesture may be required):', error);
        });
      }
    } catch (error: any) {
      console.error('Failed to connect to ElevenLabs TTS:', error);
      this.callbacks.onError?.(error.message);
      throw error;
    }
  }

  /**
   * Send initial TTS configuration
   * CRITICAL: Browser WebSocket doesn't support custom headers
   * API key MUST be sent in first message for authentication
   */
  private sendConfig(): void {
    if (!this.ws) return;

    const config = {
      text: ' ',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        use_speaker_boost: false,
      },
      generation_config: {
        chunk_length_schedule: [120, 160, 250, 290],
      },
      xi_api_key: this.config.apiKey, // Required for browser WebSocket auth
    };

    console.log('[ElevenLabsTTS] Sending init config (API key: ' + (this.config.apiKey ? 'present' : 'MISSING') + ')');
    this.ws.send(JSON.stringify(config));
  }

  /**
   * Handle incoming WebSocket message
   * ElevenLabs sends audio as base64-encoded string in JSON message with "audio" field
   */
  private async handleMessage(data: string | ArrayBuffer): Promise<void> {
    if (typeof data === 'string') {
      try {
        const message = JSON.parse(data);

        // Handle audio chunks (base64-encoded MP3)
        if (message.audio) {
          console.log(`[ElevenLabsTTS] Received audio chunk (${message.audio.length} chars base64)`);
          await this.playAudioChunkBase64(message.audio);

          this.callbacks.onAudio?.({
            type: 'audio',
            data: new ArrayBuffer(0), // Legacy compatibility
            timestamp: Date.now(),
          });
        }

        // Handle errors
        if (message.error) {
          console.error('[ElevenLabsTTS] Server error:', message.error);
          this.callbacks.onError?.(message.error);
        }

        // Handle other message types (isFinal, normalizedAlignment, etc.)
        if (message.isFinal) {
          console.log('[ElevenLabsTTS] Stream complete - all audio chunks received');
          this.isStreamComplete = true;

          // If queue is already empty, fire playback complete now
          if (this.audioQueue.length === 0 && !this.isPlaying) {
            console.log('[ElevenLabsTTS] ✅ Playback complete - queue already empty');
            this.callbacks.onPlaybackComplete?.();
            this.totalExpectedDuration = 0;
            this.playbackStartTime = null;
            this.isStreamComplete = false;
          }
        }
      } catch (error) {
        console.error('[ElevenLabsTTS] Failed to parse message:', error);
      }
    }
  }

  /**
   * Play audio chunk from base64-encoded string
   */
  private async playAudioChunkBase64(base64Audio: string): Promise<void> {
    if (!this.audioContext) {
      console.error('[ElevenLabsTTS] No audio context available');
      return;
    }

    // CRITICAL FIX: Resume AudioContext if suspended (browser requirement)
    if (this.audioContext.state === 'suspended') {
      console.log('[ElevenLabsTTS] AudioContext suspended, attempting to resume...');
      try {
        await this.audioContext.resume();
        console.log('[ElevenLabsTTS] AudioContext resumed successfully');
      } catch (error) {
        console.error('[ElevenLabsTTS] Failed to resume AudioContext:', error);
        this.callbacks.onError?.('Audio playback blocked - user interaction required');
        return;
      }
    }

    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;

      // Decode MP3 audio data
      console.log(`[ElevenLabsTTS] Decoding audio (${arrayBuffer.byteLength} bytes)...`);
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log(`[ElevenLabsTTS] Audio decoded successfully (${audioBuffer.duration.toFixed(2)}s)`);
      this.audioQueue.push(audioBuffer);

      if (!this.isPlaying) {
        this.playNextChunk();
      }
    } catch (error) {
      console.error('[ElevenLabsTTS] Failed to decode/play audio:', error);
      this.callbacks.onError?.(`Audio decode failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Play next audio chunk from queue
   */
  private playNextChunk(): void {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;

      // CRITICAL FIX: Only fire playback complete if stream is finished AND all audio played
      if (this.isStreamComplete && this.playbackStartTime !== null) {
        const totalPlaybackTime = Date.now() - this.playbackStartTime;
        console.log(`[ElevenLabsTTS] ✅ Playback complete - all audio played (${totalPlaybackTime}ms total)`);
        this.callbacks.onPlaybackComplete?.();

        // Reset state
        this.totalExpectedDuration = 0;
        this.playbackStartTime = null;
        this.isStreamComplete = false;
      } else {
        console.log('[ElevenLabsTTS] Queue empty but stream not complete, waiting for more audio...');
      }
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift()!;

    if (!this.audioContext) {
      console.error('[ElevenLabsTTS] No audio context for playback');
      return;
    }

    // CRITICAL FIX: Verify AudioContext is running before playback
    if (this.audioContext.state !== 'running') {
      console.error(`[ElevenLabsTTS] AudioContext not running (state: ${this.audioContext.state})`);
      this.callbacks.onError?.('Audio playback blocked - AudioContext not running');
      this.isPlaying = false;
      return;
    }

    // Track playback start time
    if (this.playbackStartTime === null) {
      this.playbackStartTime = Date.now();
      console.log(`[ElevenLabsTTS] Playback started at ${this.playbackStartTime}`);
    }

    console.log(`[ElevenLabsTTS] Playing audio chunk (${audioBuffer.duration.toFixed(2)}s)... [${this.audioQueue.length} remaining in queue]`);
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    source.onended = () => {
      console.log('[ElevenLabsTTS] Audio chunk finished');
      this.playNextChunk();
    };

    source.start();
  }

  /**
   * Stream text to TTS with stream lock protection
   */
  streamText(text: string): void {
    if (!this.isConnected || !this.ws) {
      console.warn('[ElevenLabsTTS] TTS not connected, cannot stream text');
      return;
    }

    // Check if stream lock is already held
    const now = Date.now();
    if (this.streamLock) {
      const lockDuration = this.streamLockTimestamp ? now - this.streamLockTimestamp : 0;

      // Check for timeout (stuck lock > 10 seconds)
      if (lockDuration > 10000) {
        console.warn(`[ElevenLabsTTS] 🚨 STREAM LOCK TIMEOUT: Force releasing stuck lock after ${lockDuration}ms`);
        this.streamLock = false;
        this.streamLockTimestamp = null;
      } else {
        console.warn(`[ElevenLabsTTS] ⚠️ STREAM LOCK HELD: Rejecting concurrent streamText call (lock held for ${lockDuration}ms)`);
        return;
      }
    }

    // Acquire stream lock
    this.streamLock = true;
    this.streamLockTimestamp = now;

    console.log(`[ElevenLabsTTS] 🔒 STREAM LOCK ACQUIRED: Streaming text (${text.length} chars):`, text.substring(0, 100));

    // Reset stream state for new text
    this.isStreamComplete = false;
    this.totalExpectedDuration = 0;
    this.playbackStartTime = null;

    const message = {
      text,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Flush TTS stream and release stream lock
   */
  flush(): void {
    if (!this.isConnected || !this.ws) {
      console.warn('[ElevenLabsTTS] TTS not connected, cannot flush');
      return;
    }

    console.log('[ElevenLabsTTS] Flushing stream');
    const message = {
      text: '',
    };

    this.ws.send(JSON.stringify(message));

    // Release stream lock after flushing
    if (this.streamLock) {
      const lockDuration = this.streamLockTimestamp ? Date.now() - this.streamLockTimestamp : 0;
      console.log(`[ElevenLabsTTS] 🔓 STREAM LOCK RELEASED: After flush (held for ${lockDuration}ms)`);
      this.streamLock = false;
      this.streamLockTimestamp = null;
    }
  }

  /**
   * Stop playback immediately (barge-in) and release stream lock
   */
  stop(): void {
    console.log('[ElevenLabsTTS] Stopping playback');

    // Clear audio queue
    this.audioQueue = [];

    // Reset playback state
    this.isStreamComplete = false;
    this.totalExpectedDuration = 0;
    this.playbackStartTime = null;

    // Release stream lock on stop
    if (this.streamLock) {
      const lockDuration = this.streamLockTimestamp ? Date.now() - this.streamLockTimestamp : 0;
      console.log(`[ElevenLabsTTS] 🔓 STREAM LOCK RELEASED: After stop (held for ${lockDuration}ms)`);
      this.streamLock = false;
      this.streamLockTimestamp = null;
    }

    // CRITICAL FIX: Suspend AudioContext but DON'T recreate it
    // Recreating causes state management issues
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
      console.log('[ElevenLabsTTS] AudioContext suspended');
    }

    this.isPlaying = false;
  }

  /**
   * Disconnect from TTS
   */
  disconnect(): void {
    this.stop();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
