/**
 * Application Configuration
 *
 * Centralized configuration loading from environment variables.
 * All configuration is loaded from process.env (Vite) at build time.
 */

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AgentConfig {
  maxContextMessages: number;
  sessionTimeoutMs: number;
}

export interface SecurityConfig {
  rateLimitPerMinute: number;
  maxTransactionSol: number;
}

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId?: string;
  model?: string;
}

export interface SolanaConfig {
  rpcUrl: string;
}

export interface FeatureFlags {
  enableAgent: boolean;
  enableVoice: boolean;
  debugMode: boolean;
}

export interface AppConfig {
  openai: OpenAIConfig;
  agent: AgentConfig;
  security: SecurityConfig;
  elevenLabs: ElevenLabsConfig;
  solana: SolanaConfig;
  features: FeatureFlags;
}

/**
 * Load configuration from environment variables
 */
function loadConfig(): AppConfig {
  return {
    openai: {
      apiKey: process.env.VITE_OPENAI_API_KEY || '',
      model: process.env.VITE_OPENAI_MODEL || 'gpt-4-turbo-preview',
      maxTokens: parseInt(process.env.VITE_OPENAI_MAX_TOKENS || '1500', 10),
      temperature: parseFloat(process.env.VITE_OPENAI_TEMPERATURE || '0.7'),
    },
    agent: {
      maxContextMessages: parseInt(process.env.VITE_AGENT_MAX_CONTEXT_MESSAGES || '20', 10),
      sessionTimeoutMs: parseInt(process.env.VITE_AGENT_SESSION_TIMEOUT_MS || '1800000', 10),
    },
    security: {
      rateLimitPerMinute: parseInt(process.env.VITE_AGENT_RATE_LIMIT_PER_MINUTE || '10', 10),
      maxTransactionSol: parseFloat(process.env.VITE_AGENT_MAX_TRANSACTION_SOL || '10'),
    },
    elevenLabs: {
      apiKey: process.env.VITE_ELEVENLABS_API_KEY || '',
      voiceId: process.env.VITE_ELEVENLABS_VOICE_ID,
      model: process.env.VITE_ELEVENLABS_MODEL || 'eleven_turbo_v2_5',
    },
    solana: {
      rpcUrl: process.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    },
    features: {
      enableAgent: process.env.VITE_ENABLE_AGENT !== 'false',
      enableVoice: process.env.VITE_ENABLE_VOICE !== 'false',
      debugMode: process.env.VITE_DEBUG_MODE === 'true',
    },
  };
}

/**
 * Validate configuration
 */
function validateConfig(config: AppConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // OpenAI validation
  if (config.features.enableAgent) {
    if (!config.openai.apiKey) {
      errors.push('OpenAI API key is required when agent is enabled (VITE_OPENAI_API_KEY)');
    }
    if (config.openai.maxTokens < 100 || config.openai.maxTokens > 4000) {
      errors.push('OpenAI max tokens must be between 100 and 4000');
    }
    if (config.openai.temperature < 0 || config.openai.temperature > 2) {
      errors.push('OpenAI temperature must be between 0 and 2');
    }
  }

  // ElevenLabs validation
  if (config.features.enableVoice) {
    if (!config.elevenLabs.apiKey) {
      errors.push('ElevenLabs API key is required when voice is enabled (VITE_ELEVENLABS_API_KEY)');
    }
  }

  // Agent validation
  if (config.agent.maxContextMessages < 1 || config.agent.maxContextMessages > 100) {
    errors.push('Agent max context messages must be between 1 and 100');
  }
  if (config.agent.sessionTimeoutMs < 60000 || config.agent.sessionTimeoutMs > 86400000) {
    errors.push('Agent session timeout must be between 1 minute and 24 hours');
  }

  // Security validation
  if (config.security.rateLimitPerMinute < 1 || config.security.rateLimitPerMinute > 1000) {
    errors.push('Rate limit must be between 1 and 1000 requests per minute');
  }
  if (config.security.maxTransactionSol < 0.001 || config.security.maxTransactionSol > 1000000) {
    errors.push('Max transaction SOL must be between 0.001 and 1,000,000');
  }

  // Solana validation
  if (!config.solana.rpcUrl || !config.solana.rpcUrl.startsWith('http')) {
    errors.push('Valid Solana RPC URL is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export singleton config instance
 */
export const config = loadConfig();

/**
 * Validate configuration on load
 */
const validation = validateConfig(config);
if (!validation.valid) {
  console.error('[Config] Configuration validation failed:');
  validation.errors.forEach(error => console.error(`  - ${error}`));
}

/**
 * Export validation result
 */
export const configValidation = validation;

/**
 * Helper to check if agent is available
 */
export function isAgentAvailable(): boolean {
  return config.features.enableAgent && !!config.openai.apiKey;
}

/**
 * Helper to check if voice is available
 */
export function isVoiceAvailable(): boolean {
  return config.features.enableVoice && !!config.elevenLabs.apiKey;
}

/**
 * Export individual config sections for convenience
 */
export const openaiConfig = config.openai;
export const agentConfig = config.agent;
export const securityConfig = config.security;
export const elevenLabsConfig = config.elevenLabs;
export const solanaConfig = config.solana;
export const featureFlags = config.features;
