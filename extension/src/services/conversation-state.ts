/**
 * Conversation State Machine for Full Duplex Voice
 *
 * Manages the state transitions for full duplex conversation with barge-in
 * States: LISTENING, SPEAKING, BARGE_IN, THINKING
 */

export type ConversationState = 'LISTENING' | 'SPEAKING' | 'BARGE_IN' | 'THINKING' | 'IDLE';

export interface StateTransition {
  from: ConversationState;
  to: ConversationState;
  timestamp: number;
  reason?: string;
}

export interface ConversationStateCallbacks {
  onStateChange?: (from: ConversationState, to: ConversationState, reason?: string) => void;
  onBargeIn?: () => void;
  onListening?: () => void;
  onSpeaking?: () => void;
  onThinking?: () => void;
}

export class ConversationStateMachine {
  private state: ConversationState = 'IDLE';
  private history: StateTransition[] = [];
  private callbacks: ConversationStateCallbacks;
  private maxHistorySize = 50;

  constructor(callbacks: ConversationStateCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Get current state
   */
  getState(): ConversationState {
    return this.state;
  }

  /**
   * Transition to new state
   */
  transition(to: ConversationState, reason?: string): boolean {
    const from = this.state;

    // Validate transition
    if (!this.isValidTransition(from, to)) {
      console.warn(`Invalid state transition: ${from} -> ${to}`);
      return false;
    }

    // Record transition
    const transition: StateTransition = {
      from,
      to,
      timestamp: Date.now(),
      reason,
    };

    this.history.push(transition);

    // Trim history if too large
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Update state
    this.state = to;

    // Trigger callbacks
    this.callbacks.onStateChange?.(from, to, reason);

    switch (to) {
      case 'BARGE_IN':
        this.callbacks.onBargeIn?.();
        break;
      case 'LISTENING':
        this.callbacks.onListening?.();
        break;
      case 'SPEAKING':
        this.callbacks.onSpeaking?.();
        break;
      case 'THINKING':
        this.callbacks.onThinking?.();
        break;
    }

    return true;
  }

  /**
   * Check if transition is valid
   */
  private isValidTransition(from: ConversationState, to: ConversationState): boolean {
    const validTransitions: Record<ConversationState, ConversationState[]> = {
      IDLE: ['LISTENING', 'THINKING'],
      LISTENING: ['THINKING', 'IDLE', 'SPEAKING'],
      THINKING: ['SPEAKING', 'LISTENING', 'IDLE'],
      SPEAKING: ['LISTENING', 'BARGE_IN', 'IDLE'],
      BARGE_IN: ['LISTENING', 'IDLE'],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  /**
   * Get state history
   */
  getHistory(): StateTransition[] {
    return [...this.history];
  }

  /**
   * Reset state machine
   */
  reset(): void {
    this.transition('IDLE', 'Reset');
  }

  /**
   * Get time in current state (ms)
   */
  getTimeInCurrentState(): number {
    const lastTransition = this.history[this.history.length - 1];
    if (!lastTransition) return 0;
    return Date.now() - lastTransition.timestamp;
  }

  /**
   * Check if currently in a specific state
   */
  is(state: ConversationState): boolean {
    return this.state === state;
  }

  /**
   * Check if AI is currently speaking
   */
  isSpeaking(): boolean {
    return this.state === 'SPEAKING';
  }

  /**
   * Check if user barged in
   */
  isBargedIn(): boolean {
    return this.state === 'BARGE_IN';
  }

  /**
   * Check if listening for user input
   */
  isListening(): boolean {
    return this.state === 'LISTENING';
  }

  /**
   * Check if processing/thinking
   */
  isThinking(): boolean {
    return this.state === 'THINKING';
  }
}
