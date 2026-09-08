/**
 * Full Duplex Coordinator
 *
 * Orchestrates all components for full duplex voice conversation:
 * - Browser Speech Recognition (STT)
 * - ElevenLabs WebSocket Streaming (TTS)
 * - Conversation state machine
 * - Barge-in detection
 */

import { BrowserSTT, TranscriptEvent } from './browser-stt';
import { ElevenLabsTTS } from './elevenlabs-realtime';
import { ConversationStateMachine, ConversationState } from './conversation-state';
import { BargeInDetector, BargeInEvent } from './barge-in-detector';
import type { UIContent, ConfirmationData } from './agent-coordinator';
import { CHANNEL, RPC_METHODS } from '../shared/constants';
import { ToolRegistry, AgentEventBus, AgentTool, AgentEvent } from './agent-tools';

export interface FullDuplexCallbacks {
  onUserTranscript?: (text: string, isFinal: boolean) => void;
  onAIResponse?: (text: string) => void;
  onStateChange?: (state: ConversationState) => void;
  onError?: (error: string) => void;
  onBargeIn?: (event: BargeInEvent) => void;
  onUIUpdate?: (ui: UIContent) => void;
  onConfirmationRequired?: (data: ConfirmationData) => void;
  onToolCall?: (toolName: string, params: any, result: any) => void;
  onEvent?: (event: AgentEvent) => void;
}

export interface FullDuplexConfig {
  elevenLabsApiKey: string;
  elevenLabsVoiceId?: string;
  elevenLabsModel?: string;
  openaiApiKey?: string;
  bargeInEnabled?: boolean;
  debugMode?: boolean;
}

export class FullDuplexCoordinator {
  private stt: BrowserSTT;
  private tts: ElevenLabsTTS;
  private stateMachine: ConversationStateMachine;
  private bargeInDetector: BargeInDetector;
  private config: FullDuplexConfig;
  private callbacks: FullDuplexCallbacks;
  private isRunning = false;

  // Tool system
  private toolRegistry: ToolRegistry;
  private eventBus: AgentEventBus;

  // Single output lock to prevent duplicate responses
  private outputLock = false;
  private outputLockTimestamp: number | null = null;
  private outputLockText: string = '';
  private outputAuditLog: Array<{
    timestamp: number;
    action: 'lock_acquired' | 'lock_released' | 'lock_rejected' | 'lock_timeout' | 'duplicate_dropped';
    text?: string;
    duration?: number;
    responseId?: number;
  }> = [];

  // Response deduplication to prevent repeating same response
  private responseIdCounter = 0;
  private lastSpokenResponse: string = '';
  private lastSpokenTimestamp: number = 0;
  private lastResponseId: number = -1;
  private DUPLICATE_WINDOW_MS = 5000; // Drop duplicates within 5 seconds

  constructor(config: FullDuplexConfig, callbacks: FullDuplexCallbacks = {}) {
    this.config = {
      bargeInEnabled: true,
      debugMode: false,
      ...config,
    };
    this.callbacks = callbacks;

    // Initialize browser STT (Web Speech API)
    this.stt = new BrowserSTT(
      {
        language: 'en-US',
        continuous: true,
        interimResults: true,
      },
      {
        onTranscript: (event) => this.handleTranscript(event),
        onError: (error) => this.handleError('STT', error),
        onStart: () => this.log('STT started'),
        onEnd: () => this.log('STT ended'),
      }
    );

    // Initialize ElevenLabs TTS WebSocket
    this.tts = new ElevenLabsTTS(
      {
        apiKey: config.elevenLabsApiKey,
        voiceId: config.elevenLabsVoiceId || '8DzKSPdgEQPaK5vKG0Rs',
        model: config.elevenLabsModel || 'eleven_multilingual_v2',
      },
      {
        onAudio: () => this.log('Audio chunk received'),
        onError: (error) => this.handleError('TTS', error),
        onConnected: () => this.log('TTS connected'),
        onDisconnected: () => this.log('TTS disconnected'),
        onPlaybackComplete: () => this.handlePlaybackComplete(),
      }
    );

    this.stateMachine = new ConversationStateMachine({
      onStateChange: (from, to, reason) => {
        this.log(`State: ${from} -> ${to} (${reason})`);
        this.callbacks.onStateChange?.(to);
      },
      onBargeIn: () => this.handleBargeIn(),
    });

    this.bargeInDetector = new BargeInDetector();
    this.bargeInDetector.setBargeInCallback((event) => {
      this.callbacks.onBargeIn?.(event);
      this.stateMachine.transition('BARGE_IN', 'User interrupted');
    });

    // Initialize tool system
    this.toolRegistry = new ToolRegistry();
    this.eventBus = new AgentEventBus();

    // Subscribe to events and forward to callbacks
    this.eventBus.subscribe((event) => {
      this.callbacks.onEvent?.(event);
    });
  }

  /**
   * Verify AI agent is ready (runs in background service worker)
   * Note: Wallet unlock checks are enforced at RPC layer (background context)
   */
  private async verifyAgent(): Promise<void> {
    if (!this.config.openaiApiKey) {
      this.log('No OpenAI API key - agent disabled');
      return;
    }

    try {
      this.log('Verifying background AI agent...');
      // Agent runs in background - just verify it's accessible
      this.log('✅ Agent coordinator ready (background context)');
    } catch (error: any) {
      this.log(`❌ Failed to verify agent: ${error.message}`);
      console.error('[FullDuplex] Agent verification error:', error);
      throw error;
    }
  }

  /**
   * Start full duplex conversation
   * Note: Wallet unlock checks are enforced at RPC layer when agent processes messages
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('Already running');
      return;
    }

    try {
      // Check browser STT support
      if (!BrowserSTT.isSupported()) {
        throw new Error('Speech Recognition not supported in this browser');
      }

      // Verify AI agent (runs in background)
      await this.verifyAgent();

      // Connect to ElevenLabs TTS WebSocket
      await this.tts.connect();

      // Start browser STT
      this.stt.start();

      // Transition to listening state
      this.stateMachine.transition('LISTENING', 'Session started');

      this.isRunning = true;
      this.log('Full duplex conversation started');
    } catch (error: any) {
      this.handleError('Start', error.message);
      throw error;
    }
  }

  /**
   * Stop full duplex conversation
   */
  stop(): void {
    if (!this.isRunning) return;

    this.stt.stop();
    this.tts.disconnect();

    this.stateMachine.reset();
    this.bargeInDetector.reset();

    this.isRunning = false;
    this.log('Full duplex conversation stopped');
  }

  /**
   * Handle transcript from STT
   */
  private handleTranscript(event: TranscriptEvent): void {
    const isFinal = event.type === 'final';
    const text = event.text;

    this.callbacks.onUserTranscript?.(text, isFinal);

    // Check for barge-in when user speaks during AI speech
    // IMPORTANT: Only trigger on FINAL transcripts with meaningful content (5+ chars)
    // This prevents false triggers from background noise, whispers, or interim results
    if (this.config.bargeInEnabled && this.stateMachine.isSpeaking() && isFinal && text.trim().length > 5) {
      this.log('Barge-in detected via transcript');
      this.stateMachine.transition('BARGE_IN', 'User interrupted');
    }

    if (isFinal && text.trim().length > 0) {
      // User finished speaking - process only if in LISTENING state
      // (Prevents duplicate processing if already in THINKING or SPEAKING)
      if (this.stateMachine.isListening()) {
        this.stateMachine.transition('THINKING', 'User utterance complete');

        // Process with AI agent (runs in background via RPC)
        this.processWithAgent(text);
      } else {
        this.log(`Ignoring final transcript in ${this.stateMachine.getState()} state: "${text}"`);
      }
    }
  }

  /**
   * Process user message with AI agent (via RPC to background service worker)
   */
  private async processWithAgent(text: string): Promise<void> {
    try {
      this.log(`🤖 Processing with agent: "${text}"`);

      // Get tool definitions for agent
      const tools = this.toolRegistry.getOpenAIFunctions();

      // Call agent in background via RPC
      const response = await chrome.runtime.sendMessage({
        channel: CHANNEL,
        id: crypto.randomUUID(),
        method: RPC_METHODS.AGENT_CHAT,
        params: {
          message: text,
          mode: 'voice',
          tools, // Pass tool definitions to agent
        },
      });

      console.log('[FullDuplex] Raw RPC response:', response);

      if (!response || !response.ok) {
        throw new Error(response?.error || 'RPC call failed');
      }

      const agentResponse = response.result;

      if (!agentResponse || !agentResponse.text) {
        throw new Error('Response missing text field');
      }

      this.log(`✅ Agent response: "${agentResponse.text}"`);

      // Handle tool calls if present
      if (agentResponse.toolCalls && Array.isArray(agentResponse.toolCalls)) {
        this.log(`🔧 Processing ${agentResponse.toolCalls.length} tool calls`);
        await this.handleToolCalls(agentResponse.toolCalls);
      }

      // Speak the response
      this.speakResponse(agentResponse.text);

      // Handle UI updates
      if (agentResponse.ui) {
        this.log('📊 UI update received');
        this.callbacks.onUIUpdate?.(agentResponse.ui);
      }

      // Handle confirmation requests
      if (agentResponse.requiresConfirmation && agentResponse.confirmationData) {
        this.log('⚠️ Confirmation required');
        this.callbacks.onConfirmationRequired?.(agentResponse.confirmationData);
      }
    } catch (error: any) {
      this.log(`❌ Agent error: ${error.message || error}`);
      console.error('[FullDuplex] Agent processing error:', error);
      console.error('[FullDuplex] Error stack:', error.stack);
      this.speakResponse('Sorry, I encountered an error processing your request.');
    }
  }

  /**
   * Handle tool calls from agent
   */
  private async handleToolCalls(toolCalls: Array<{ name: string; params: any }>): Promise<void> {
    for (const toolCall of toolCalls) {
      try {
        this.log(`🔧 Executing tool: ${toolCall.name}`);
        const result = await this.toolRegistry.execute(toolCall.name, toolCall.params);

        if (result.success) {
          this.log(`✅ Tool executed successfully: ${toolCall.name}`);
          this.callbacks.onToolCall?.(toolCall.name, toolCall.params, result.data);
        } else {
          this.log(`❌ Tool execution failed: ${toolCall.name} - ${result.error}`);
          this.callbacks.onToolCall?.(toolCall.name, toolCall.params, { error: result.error });
        }
      } catch (error: any) {
        this.log(`❌ Tool execution error: ${toolCall.name} - ${error.message}`);
        this.callbacks.onToolCall?.(toolCall.name, toolCall.params, { error: error.message });
      }
    }
  }

  /**
   * Speak AI response with single output lock protection and deduplication
   */
  speakResponse(text: string): void {
    if (!this.isRunning) return;

    const now = Date.now();

    // CRITICAL: Response deduplication - prevent repeating same response
    const timeSinceLastResponse = now - this.lastSpokenTimestamp;
    const isDuplicate = text === this.lastSpokenResponse && timeSinceLastResponse < this.DUPLICATE_WINDOW_MS;

    if (isDuplicate) {
      this.log(`🚫 DUPLICATE RESPONSE DROPPED: "${text.substring(0, 50)}..." (same as response #${this.lastResponseId}, ${timeSinceLastResponse}ms ago)`);
      this.auditLog('duplicate_dropped', text, timeSinceLastResponse, this.lastResponseId);
      return;
    }

    // Check if output lock is already held
    if (this.outputLock) {
      const lockDuration = this.outputLockTimestamp ? now - this.outputLockTimestamp : 0;

      // Audit log: Lock rejection
      this.auditLog('lock_rejected', text, lockDuration);

      // Log warning
      this.log(`⚠️ OUTPUT LOCK REJECTED: Already speaking. Current: "${this.outputLockText.substring(0, 50)}...", Attempted: "${text.substring(0, 50)}...", Lock held for: ${lockDuration}ms`);

      // Check for timeout (stuck lock > 30 seconds)
      if (lockDuration > 30000) {
        this.auditLog('lock_timeout', this.outputLockText, lockDuration);
        this.log(`🚨 OUTPUT LOCK TIMEOUT: Force releasing stuck lock after ${lockDuration}ms`);
        this.releaseOutputLock();
      } else {
        // Reject duplicate response
        return;
      }
    }

    // Generate unique response ID
    const responseId = ++this.responseIdCounter;

    // Update deduplication tracking
    this.lastSpokenResponse = text;
    this.lastSpokenTimestamp = now;
    this.lastResponseId = responseId;

    // Acquire output lock
    this.outputLock = true;
    this.outputLockTimestamp = now;
    this.outputLockText = text;

    // Audit log: Lock acquired
    this.auditLog('lock_acquired', text, undefined, responseId);

    this.log(`🔒 OUTPUT LOCK ACQUIRED [Response #${responseId}]: "${text.substring(0, 100)}..."`);

    this.callbacks.onAIResponse?.(text);

    // Transition to speaking state
    this.stateMachine.transition('SPEAKING', 'AI response ready');

    // Stream text to TTS
    this.tts.streamText(text);
    this.tts.flush();

    // State will transition back to LISTENING when playback completes
    // (see handlePlaybackComplete method where lock is released)
  }

  /**
   * Handle TTS playback completion
   */
  private handlePlaybackComplete(): void {
    this.log('🔊 Playback complete');

    // Release output lock
    this.releaseOutputLock();

    // Return to listening state after AI finishes speaking
    if (this.stateMachine.isSpeaking()) {
      this.stateMachine.transition('LISTENING', 'AI finished speaking');
    }
  }

  /**
   * Handle barge-in event
   */
  private handleBargeIn(): void {
    this.log('Barge-in detected!');

    // Stop TTS immediately
    this.tts.stop();

    // Release output lock (user interrupted)
    this.releaseOutputLock();

    // Clear last spoken response (user interrupted, allow repeat if they ask again)
    this.lastSpokenResponse = '';
    this.lastSpokenTimestamp = 0;

    // Return to listening
    this.stateMachine.transition('LISTENING', 'Barge-in handled');

    // Reset barge-in detector
    this.bargeInDetector.reset();
  }

  /**
   * Handle errors
   */
  private handleError(source: string, error: string): void {
    const errorMsg = `[${source}] ${error}`;
    this.log(errorMsg);
    this.callbacks.onError?.(errorMsg);
  }

  /**
   * Debug logging
   */
  private log(message: string): void {
    if (this.config.debugMode) {
      console.log(`[FullDuplex] ${message}`);
    }
  }

  /**
   * Get current state
   */
  getState(): ConversationState {
    return this.stateMachine.getState();
  }

  /**
   * Check if running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Release output lock
   */
  private releaseOutputLock(): void {
    if (this.outputLock) {
      const duration = this.outputLockTimestamp ? Date.now() - this.outputLockTimestamp : 0;

      // Audit log: Lock released
      this.auditLog('lock_released', this.outputLockText, duration);

      this.log(`🔓 OUTPUT LOCK RELEASED: "${this.outputLockText.substring(0, 50)}..." (held for ${duration}ms)`);

      this.outputLock = false;
      this.outputLockTimestamp = null;
      this.outputLockText = '';
    }
  }

  /**
   * Add entry to audit log
   */
  private auditLog(
    action: 'lock_acquired' | 'lock_released' | 'lock_rejected' | 'lock_timeout' | 'duplicate_dropped',
    text?: string,
    duration?: number,
    responseId?: number
  ): void {
    const entry = {
      timestamp: Date.now(),
      action,
      text: text?.substring(0, 100),
      duration,
      responseId,
    };

    this.outputAuditLog.push(entry);

    // Keep only last 100 entries
    if (this.outputAuditLog.length > 100) {
      this.outputAuditLog.shift();
    }

    // Log to console if debug mode
    if (this.config.debugMode) {
      console.log(`[FullDuplex] Audit:`, entry);
    }
  }

  /**
   * Get output lock audit log (for debugging)
   */
  getOutputAuditLog(): Array<{
    timestamp: number;
    action: string;
    text?: string;
    duration?: number;
  }> {
    return [...this.outputAuditLog];
  }

  /**
   * Get output lock status (for debugging)
   */
  getOutputLockStatus(): {
    locked: boolean;
    timestamp: number | null;
    text: string;
    duration: number;
  } {
    return {
      locked: this.outputLock,
      timestamp: this.outputLockTimestamp,
      text: this.outputLockText,
      duration: this.outputLockTimestamp ? Date.now() - this.outputLockTimestamp : 0,
    };
  }

  /**
   * Register tool for agent to call
   */
  registerTool(tool: AgentTool): void {
    this.toolRegistry.register(tool);
    this.log(`Tool registered: ${tool.name}`);
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: AgentTool[]): void {
    this.toolRegistry.registerAll(tools);
    this.log(`Registered ${tools.length} tools`);
  }

  /**
   * Send event to agent
   */
  sendEvent(type: string, data: Record<string, any>, context?: Record<string, any>): void {
    this.eventBus.send(type, data, context);
    this.log(`Event sent: ${type}`);
  }

  /**
   * Get registered tools
   */
  getTools(): AgentTool[] {
    return this.toolRegistry.getAll();
  }

}
