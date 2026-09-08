/**
 * Context Manager
 *
 * Manages conversation state and history for the AI agent.
 * Stores message history, wallet state cache, and user preferences.
 */

import type { Message } from './openai-service';

export interface WalletState {
  address?: string;
  balance?: number;
  tokens?: any[];
  lastUpdated?: number;
}

export interface UserPreferences {
  voiceEnabled?: boolean;
  confirmationLevel?: 'always' | 'transactions' | 'never';
  language?: string;
}

export interface ConversationContext {
  messages: Message[];
  walletState?: WalletState;
  preferences?: UserPreferences;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'agent_context';
const MAX_MESSAGES = 20;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export class ContextManager {
  private context: ConversationContext;
  private saveTimeout?: NodeJS.Timeout;

  constructor() {
    this.context = this.createNewContext();
  }

  /**
   * Initialize context from storage
   */
  async init(): Promise<void> {
    try {
      const stored = await this.loadFromStorage();

      if (stored) {
        // Check if session is expired
        const now = Date.now();
        const age = now - stored.updatedAt;

        if (age < SESSION_TIMEOUT_MS) {
          this.context = stored;
          return;
        }
      }

      // Create new session if no valid stored context
      this.context = this.createNewContext();
      await this.saveToStorage();
    } catch (error) {
      console.error('[ContextManager] Error loading context:', error);
      this.context = this.createNewContext();
    }
  }

  /**
   * Save a message to history
   */
  async saveMessage(role: 'user' | 'assistant' | 'system', content: string): Promise<void> {
    const message: Message = {
      role,
      content,
    };

    this.context.messages.push(message);

    // Trim messages if exceeding max
    if (this.context.messages.length > MAX_MESSAGES) {
      // Keep system message if present, trim oldest user/assistant messages
      const systemMessages = this.context.messages.filter(m => m.role === 'system');
      const otherMessages = this.context.messages.filter(m => m.role !== 'system');
      const trimmed = otherMessages.slice(-MAX_MESSAGES);
      this.context.messages = [...systemMessages, ...trimmed];
    }

    this.context.updatedAt = Date.now();
    await this.debouncedSave();
  }

  /**
   * Get conversation history
   */
  async getHistory(limit: number = MAX_MESSAGES): Promise<Message[]> {
    // Return all messages except system messages (those are added separately)
    const messages = this.context.messages.filter(m => m.role !== 'system');
    return messages.slice(-limit);
  }

  /**
   * Update wallet state cache
   */
  async updateWalletCache(state: Partial<WalletState>): Promise<void> {
    this.context.walletState = {
      ...this.context.walletState,
      ...state,
      lastUpdated: Date.now(),
    };

    this.context.updatedAt = Date.now();
    await this.debouncedSave();
  }

  /**
   * Get wallet state cache
   */
  getWalletCache(): WalletState | undefined {
    return this.context.walletState;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    this.context.preferences = {
      ...this.context.preferences,
      ...preferences,
    };

    this.context.updatedAt = Date.now();
    await this.debouncedSave();
  }

  /**
   * Get user preferences
   */
  getPreferences(): UserPreferences {
    return this.context.preferences || {};
  }

  /**
   * Clear conversation history
   */
  async clear(): Promise<void> {
    this.context = this.createNewContext();
    await this.saveToStorage();
  }

  /**
   * Get session info
   */
  getSessionInfo() {
    return {
      sessionId: this.context.sessionId,
      messageCount: this.context.messages.length,
      createdAt: this.context.createdAt,
      updatedAt: this.context.updatedAt,
      age: Date.now() - this.context.createdAt,
    };
  }

  /**
   * Create new context
   */
  private createNewContext(): ConversationContext {
    return {
      messages: [],
      sessionId: this.generateSessionId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Debounced save to avoid excessive storage writes
   */
  private async debouncedSave(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      await this.saveToStorage();
    }, 1000);
  }

  /**
   * Save context to storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({
          [STORAGE_KEY]: this.context,
        });
      } else {
        // Fallback to localStorage for testing
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.context));
      }
    } catch (error) {
      console.error('[ContextManager] Error saving context:', error);
    }
  }

  /**
   * Load context from storage
   */
  private async loadFromStorage(): Promise<ConversationContext | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        return result[STORAGE_KEY] || null;
      } else {
        // Fallback to localStorage for testing
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
      }
    } catch (error) {
      console.error('[ContextManager] Error loading context:', error);
      return null;
    }
  }
}

// Export singleton instance
export const contextManager = new ContextManager();
