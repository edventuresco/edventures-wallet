/**
 * OpenAI Service
 *
 * Handles all OpenAI API interactions including:
 * - Streaming chat completions
 * - Function call handling
 * - Error recovery with exponential backoff
 * - Token counting and cost tracking
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool, ChatCompletionChunk } from 'openai/resources/chat/completions';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface ChatResponse {
  message: string;
  functionCalls?: FunctionCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface FunctionCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ChatChunk {
  delta: string;
  functionCall?: Partial<FunctionCall>;
  done: boolean;
}

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class OpenAIService {
  private client: OpenAI;
  private config: Required<OpenAIConfig>;
  private requestCount: number = 0;
  private totalTokens: number = 0;

  constructor(config: OpenAIConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'gpt-4-turbo-preview',
      maxTokens: config.maxTokens || 1500,
      temperature: config.temperature || 0.7,
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true, // For extension environment
    });
  }

  /**
   * Send a chat message and get a complete response
   */
  async chat(
    messages: Message[],
    tools?: Tool[],
    toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  ): Promise<ChatResponse> {
    return this.retryWithBackoff(async () => {
      const completion = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages as ChatCompletionMessageParam[],
        tools: tools as ChatCompletionTool[],
        tool_choice: toolChoice,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      this.requestCount++;

      const usage = completion.usage;
      if (usage) {
        this.totalTokens += usage.total_tokens;
      }

      const choice = completion.choices[0];
      const message = choice.message;

      // Extract function calls if present
      const functionCalls: FunctionCall[] = [];
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.type === 'function') {
            try {
              functionCalls.push({
                id: toolCall.id,
                name: toolCall.function.name,
                arguments: JSON.parse(toolCall.function.arguments),
              });
            } catch (error) {
              console.error('Failed to parse function arguments:', error);
            }
          }
        }
      }

      return {
        message: message.content || '',
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        usage: usage
          ? {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            }
          : undefined,
      };
    });
  }

  /**
   * Stream a chat response with real-time token generation
   */
  async *streamChat(
    messages: Message[],
    tools?: Tool[],
    toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  ): AsyncGenerator<ChatChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages as ChatCompletionMessageParam[],
      tools: tools as ChatCompletionTool[],
      tool_choice: toolChoice,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: true,
    });

    this.requestCount++;

    let accumulatedFunctionCall: Partial<FunctionCall> = {};
    let accumulatedMessage = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (!delta) {
        continue;
      }

      // Handle text content
      if (delta.content) {
        accumulatedMessage += delta.content;
        yield {
          delta: delta.content,
          done: false,
        };
      }

      // Handle function calls
      if (delta.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.type === 'function') {
            if (toolCall.id) {
              accumulatedFunctionCall.id = toolCall.id;
            }
            if (toolCall.function?.name) {
              accumulatedFunctionCall.name = toolCall.function.name;
            }
            if (toolCall.function?.arguments) {
              accumulatedFunctionCall.arguments = accumulatedFunctionCall.arguments || {};
              // Accumulate arguments (they come in chunks)
              const argsString = (accumulatedFunctionCall.arguments as any).__raw || '';
              (accumulatedFunctionCall.arguments as any).__raw = argsString + toolCall.function.arguments;
            }

            yield {
              delta: '',
              functionCall: accumulatedFunctionCall,
              done: false,
            };
          }
        }
      }

      // Check if stream is done
      const finishReason = chunk.choices[0]?.finish_reason;
      if (finishReason) {
        // Parse accumulated function arguments if present
        if (accumulatedFunctionCall.arguments && (accumulatedFunctionCall.arguments as any).__raw) {
          try {
            const parsed = JSON.parse((accumulatedFunctionCall.arguments as any).__raw);
            accumulatedFunctionCall.arguments = parsed;
          } catch (error) {
            console.error('Failed to parse accumulated function arguments:', error);
          }
        }

        yield {
          delta: '',
          functionCall: accumulatedFunctionCall.name ? accumulatedFunctionCall as FunctionCall : undefined,
          done: true,
        };
      }
    }
  }

  /**
   * Retry a function with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Don't retry on certain errors
        if (
          error.status === 401 || // Invalid API key
          error.status === 400    // Bad request
        ) {
          throw error;
        }

        // Rate limit error - use retry-after header if available
        if (error.status === 429) {
          const retryAfter = error.headers?.['retry-after'];
          const delay = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.min(1000 * Math.pow(2, attempt), 10000);

          console.warn(`Rate limited. Retrying after ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }

        // Network or server errors - exponential backoff
        if (error.status >= 500 || error.code === 'ECONNREFUSED') {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.warn(`Request failed. Retrying after ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }

        // Unknown error - throw immediately
        throw error;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get usage statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      totalTokens: this.totalTokens,
      estimatedCost: this.estimateCost(),
    };
  }

  /**
   * Estimate API cost based on token usage
   * GPT-4 Turbo pricing: $10/1M prompt tokens, $30/1M completion tokens
   * Simplified: average $20/1M tokens
   */
  private estimateCost(): number {
    return (this.totalTokens / 1_000_000) * 20;
  }

  /**
   * Reset usage statistics
   */
  resetStats() {
    this.requestCount = 0;
    this.totalTokens = 0;
  }
}
