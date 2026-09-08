/**
 * Full Duplex Voice Panel Component
 *
 * React component for full duplex voice conversation with barge-in
 * Features:
 * - Continuous listening (always-on mic)
 * - Real-time transcription
 * - Barge-in detection and handling
 * - Visual feedback for conversation state
 */

import React, { useState, useEffect, useRef } from 'react';
import { FullDuplexCoordinator, FullDuplexConfig } from '../../services/full-duplex-coordinator';
import { ConversationState } from '../../services/conversation-state';
import { BargeInEvent } from '../../services/barge-in-detector';
import { VoicePanel } from './VoicePanel';
import './FullDuplexVoicePanel.css';
import {
  defaultTools,
  openSendMoneyTool,
  getBalanceTool,
  getAddressTool,
  copyAddressTool,
  refreshBalanceTool,
  AgentEvent,
} from '../../services/agent-tools';
import { fetchSOLPrice, formatBalanceWithUSD } from '../../services/price-service';
import { CHANNEL } from '../../shared/constants';

export interface FullDuplexVoicePanelProps {
  onCommand?: (action: string, params: any) => void;
  onToolCall?: (toolName: string, params: any, result: any) => void;
  onEvent?: (event: AgentEvent) => void;
  isEnabled: boolean;
}

export function FullDuplexVoicePanel({ onCommand, onToolCall, onEvent, isEnabled }: FullDuplexVoicePanelProps) {
  const [isActive, setIsActive] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>('IDLE');
  const [userTranscript, setUserTranscript] = useState('');
  const [aiResponse, setAIResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bargeInCount, setBargeInCount] = useState(0);
  const [hasElevenLabsKey, setHasElevenLabsKey] = useState(true);

  const coordinatorRef = useRef<FullDuplexCoordinator | null>(null);

  useEffect(() => {
    // Check if ElevenLabs is configured
    const elevenLabsApiKey = process.env.VITE_ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey || elevenLabsApiKey.trim() === '') {
      console.log('[FullDuplexVoice] ElevenLabs not configured, falling back to legacy voice panel');
      setHasElevenLabsKey(false);
      return;
    }

    // Initialize coordinator on mount
    const voiceId = process.env.VITE_ELEVENLABS_VOICE_ID;
    const model = process.env.VITE_ELEVENLABS_MODEL;
    const openaiApiKey = process.env.VITE_OPENAI_API_KEY;

    const config: FullDuplexConfig = {
      elevenLabsApiKey: elevenLabsApiKey,
      elevenLabsVoiceId: voiceId,
      elevenLabsModel: model,
      openaiApiKey: openaiApiKey, // ✅ ADD THIS!
      bargeInEnabled: true,
      debugMode: process.env.VITE_DEBUG_MODE === 'true',
    };

    // Log configuration status
    console.log('[FullDuplexVoice] Configuration:', {
      hasElevenLabs: !!elevenLabsApiKey,
      hasOpenAI: !!openaiApiKey,
      voiceId,
      model,
    });

    if (!openaiApiKey) {
      console.warn('[FullDuplexVoice] OpenAI API key not configured - agent will not work!');
      setError('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to .env');
    }

    coordinatorRef.current = new FullDuplexCoordinator(config, {
      onUserTranscript: (text, isFinal) => {
        setUserTranscript(text);
        if (isFinal) {
          // TODO: Parse command and execute
          console.log('Final transcript:', text);
        }
      },
      onAIResponse: (text) => {
        setAIResponse(text);
      },
      onStateChange: (state) => {
        setConversationState(state);
      },
      onError: (errorMsg) => {
        setError(errorMsg);
        console.error('Full duplex error:', errorMsg);
      },
      onBargeIn: (event: BargeInEvent) => {
        setBargeInCount((prev) => prev + 1);
        console.log('Barge-in detected:', event);
      },
      onToolCall: (toolName, params, result) => {
        console.log('[FullDuplexVoice] Tool called:', toolName, params, result);
        onToolCall?.(toolName, params, result);
      },
      onEvent: (event) => {
        console.log('[FullDuplexVoice] Event:', event);
        onEvent?.(event);
      },
    });

    // Register wallet operation tools
    if (onCommand) {
      // Create tools with handlers that use onCommand callback
      const tools = [
        {
          ...openSendMoneyTool,
          handler: async (params: any) => {
            onCommand('sendTransaction', params);
            return {
              success: true,
              message: "Opening send screen!"
            };
          },
        },
        {
          ...getBalanceTool,
          handler: async () => {
            try {
              // Fetch balance from RPC
              const response = await chrome.runtime.sendMessage({
                channel: CHANNEL,
                id: crypto.randomUUID(),
                method: "getBalance",
                params: {},
              });

              console.log('[getBalanceTool] RPC response:', response);

              if (!response.ok) {
                throw new Error(response.error || 'RPC call failed');
              }

              if (typeof response.result?.balance !== 'number') {
                throw new Error('Balance not found in response');
              }

              const balance = response.result.balance;
              console.log('[getBalanceTool] Balance:', balance);

              // Fetch SOL price and format with USD (with fallback if price fails)
              let formatted;
              let solPrice = 0;
              try {
                solPrice = await fetchSOLPrice();
                formatted = formatBalanceWithUSD(balance, solPrice);
                console.log('[getBalanceTool] Formatted with USD:', formatted);
              } catch (priceError: any) {
                console.warn('[getBalanceTool] Price fetch failed, using balance only:', priceError);
                // Fallback: just format balance without USD
                formatted = {
                  sol: balance.toFixed(2),
                  solValue: balance,
                  usd: '0.00',
                  usdValue: 0
                };
              }

              // Also trigger UI update via onCommand
              onCommand?.('refreshBalance', {});

              // Return balance data with message for agent to speak
              const message = solPrice > 0
                ? `You have ${formatted.sol} SOL, worth $${formatted.usd}.`
                : `You have ${formatted.sol} SOL.`;

              return {
                message,
                balance: formatted.solValue,
                balanceFormatted: `${formatted.sol} SOL`,
                balanceUSD: formatted.usdValue,
                balanceUSDFormatted: `$${formatted.usd}`,
                solPrice,
              };
            } catch (error: any) {
              console.error('[getBalanceTool] Error:', error);
              return {
                error: error.message || 'Failed to get balance',
                message: 'Sorry, I had trouble getting your balance.'
              };
            }
          },
        },
        {
          ...getAddressTool,
          handler: async () => {
            const response = await chrome.runtime.sendMessage({
              channel: CHANNEL,
              id: crypto.randomUUID(),
              method: "getPublicKey",
              params: {},
            });
            const address = response?.result?.publicKey || "unknown";
            onCommand('getAddress', {});
            return {
              success: true,
              address,
              message: `Your address is ${address.slice(0, 4)}...${address.slice(-4)}.`
            };
          },
        },
        {
          ...copyAddressTool,
          handler: async () => {
            onCommand('copyAddress', {});
            return {
              success: true,
              message: "Address copied!"
            };
          },
        },
        {
          ...refreshBalanceTool,
          handler: async () => {
            try {
              // Fetch balance from RPC
              const response = await chrome.runtime.sendMessage({
                channel: CHANNEL,
                id: crypto.randomUUID(),
                method: "getBalance",
                params: {},
              });

              console.log('[refreshBalanceTool] RPC response:', response);

              if (!response.ok) {
                throw new Error(response.error || 'RPC call failed');
              }

              if (typeof response.result?.balance !== 'number') {
                throw new Error('Balance not found in response');
              }

              const balance = response.result.balance;
              console.log('[refreshBalanceTool] Balance:', balance);

              // Fetch SOL price and format with USD (with fallback if price fails)
              let formatted;
              let solPrice = 0;
              try {
                solPrice = await fetchSOLPrice();
                formatted = formatBalanceWithUSD(balance, solPrice);
                console.log('[refreshBalanceTool] Formatted with USD:', formatted);
              } catch (priceError: any) {
                console.warn('[refreshBalanceTool] Price fetch failed, using balance only:', priceError);
                // Fallback: just format balance without USD
                formatted = {
                  sol: balance.toFixed(2),
                  solValue: balance,
                  usd: '0.00',
                  usdValue: 0
                };
              }

              // Trigger UI update via onCommand
              onCommand?.('refreshBalance', {});

              // Return balance data with message for agent to speak
              const message = solPrice > 0
                ? `You have ${formatted.sol} SOL, worth $${formatted.usd}.`
                : `You have ${formatted.sol} SOL.`;

              return {
                message,
                balance: formatted.solValue,
                balanceFormatted: `${formatted.sol} SOL`,
                balanceUSD: formatted.usdValue,
                balanceUSDFormatted: `$${formatted.usd}`,
                solPrice,
              };
            } catch (error: any) {
              console.error('[refreshBalanceTool] Error:', error);
              return {
                error: error.message || 'Failed to refresh balance',
                message: 'Sorry, I had trouble refreshing your balance.'
              };
            }
          },
        },
      ];

      coordinatorRef.current.registerTools(tools);
      console.log('[FullDuplexVoice] Registered wallet operation tools');
    }

    return () => {
      // Cleanup on unmount
      if (coordinatorRef.current?.getIsRunning()) {
        coordinatorRef.current.stop();
      }
    };
  }, []);

  /**
   * Start full duplex conversation
   */
  const handleStart = async () => {
    if (!coordinatorRef.current) {
      setError('Coordinator not initialized');
      return;
    }

    try {
      setError(null);

      // CRITICAL FIX: Resume AudioContext with user gesture
      // Browsers require user interaction before allowing audio playback
      // This button click provides the required user gesture
      console.log('[FullDuplexVoice] User gesture detected - ensuring AudioContext can resume');

      await coordinatorRef.current.start();
      setIsActive(true);
    } catch (error: any) {
      // Wallet lock errors will come from coordinator.start() if wallet is locked
      setError(`Failed to start: ${error.message}`);
      setIsActive(false);
    }
  };

  /**
   * Stop full duplex conversation
   */
  const handleStop = () => {
    if (coordinatorRef.current) {
      coordinatorRef.current.stop();
      setIsActive(false);
      setConversationState('IDLE');
      setUserTranscript('');
      setAIResponse('');
      setBargeInCount(0);
    }
  };

  /**
   * Get state emoji
   */
  const getStateEmoji = (): string => {
    switch (conversationState) {
      case 'LISTENING':
        return '👂';
      case 'THINKING':
        return '🤔';
      case 'SPEAKING':
        return '🗣️';
      case 'BARGE_IN':
        return '✋';
      case 'IDLE':
      default:
        return '💤';
    }
  };

  /**
   * Get state description
   */
  const getStateDescription = (): string => {
    switch (conversationState) {
      case 'LISTENING':
        return 'Listening...';
      case 'THINKING':
        return 'Processing...';
      case 'SPEAKING':
        return 'Speaking...';
      case 'BARGE_IN':
        return 'Interrupted';
      case 'IDLE':
      default:
        return 'Ready';
    }
  };

  if (!isEnabled) {
    return null;
  }

  // Fallback to legacy VoicePanel if ElevenLabs not configured
  if (!hasElevenLabsKey) {
    return (
      <div>
        <div className="full-duplex-fallback-warning">
          ℹ️ Using legacy voice mode. For full duplex with Cristel, add ElevenLabs API key to .env
        </div>
        <VoicePanel onCommand={onCommand || (() => {})} isEnabled={true} />
      </div>
    );
  }

  return (
    <div className="full-duplex-voice-panel">
      <div className="full-duplex-header">
        <h3>🎙️ Full Duplex Voice</h3>
        <div className={`state-indicator state-${conversationState.toLowerCase()}`}>
          <span className="state-emoji">{getStateEmoji()}</span>
          <span className="state-text">{getStateDescription()}</span>
        </div>
      </div>

      <div className="full-duplex-content">
        {error && (
          <div className="full-duplex-error">
            ⚠️ {error}
          </div>
        )}

        <div className="full-duplex-controls">
          {!isActive ? (
            <button
              className="full-duplex-button start"
              onClick={handleStart}
              disabled={!!error}
              title="Start full duplex conversation"
            >
              ▶️ Start Conversation
            </button>
          ) : (
            <button
              className="full-duplex-button stop"
              onClick={handleStop}
              title="Stop full duplex conversation"
            >
              ⏹️ Stop Conversation
            </button>
          )}
        </div>

        {isActive && (
          <>
            {userTranscript && (
              <div className="transcript-box">
                <div className="transcript-label">You:</div>
                <div className="transcript-text">"{userTranscript}"</div>
              </div>
            )}

            {aiResponse && (
              <div className="response-box">
                <div className="response-label">Cristel:</div>
                <div className="response-text">{aiResponse}</div>
              </div>
            )}

            {bargeInCount > 0 && (
              <div className="barge-in-indicator">
                ✋ Barge-ins: {bargeInCount}
              </div>
            )}
          </>
        )}
      </div>

      <div className="full-duplex-info">
        <details>
          <summary>How it works</summary>
          <ul>
            <li>Mic is always listening while active</li>
            <li>Speak naturally - no button press needed</li>
            <li>Interrupt Cristel anytime (barge-in)</li>
            <li>Echo cancellation prevents feedback</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
