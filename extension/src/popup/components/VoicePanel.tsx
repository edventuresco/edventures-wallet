/**
 * Voice Panel Component
 *
 * React component for voice-enabled wallet interactions
 * Features:
 * - Speech-to-text using Web Speech API
 * - Command parsing and validation
 * - Text-to-speech responses (optional)
 * - Visual feedback for listening state
 */

import React, { useState, useEffect, useRef } from 'react';
import { VoiceSTT } from '../../services/voice-stt';
import { VoiceTTS } from '../../services/voice-tts';
import { ElevenLabsTTS } from '../../services/voice-tts-elevenlabs';
import { VoiceCommandParser, VoiceCommand } from '../../services/voice-commands';
import './VoicePanel.css';

export interface VoicePanelProps {
  onCommand: (action: string, params: any) => void;
  isEnabled: boolean;
}

export function VoicePanel({ onCommand, isEnabled }: VoicePanelProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [showPermissionFrame, setShowPermissionFrame] = useState(false);

  const sttRef = useRef<VoiceSTT>(new VoiceSTT());
  const ttsRef = useRef<VoiceTTS>(new VoiceTTS());
  const elevenLabsTTSRef = useRef<ElevenLabsTTS>(new ElevenLabsTTS());
  const parserRef = useRef<VoiceCommandParser>(new VoiceCommandParser());
  const [useElevenLabs, setUseElevenLabs] = useState(ElevenLabsTTS.isConfigured());

  // Check browser support on mount
  useEffect(() => {
    if (!VoiceSTT.isSupported()) {
      setIsSupported(false);
      setError('Speech recognition is not supported in this browser');
    }
  }, []);

  // Listen for permission messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'PERMISSION_GRANTED') {
        setPermissionGranted(true);
        setError(null);
        setShowPermissionFrame(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Check permission status on mount
  useEffect(() => {
    checkPermissionStatus();
  }, []);

  /**
   * Check microphone permission status
   */
  const checkPermissionStatus = async () => {
    try {
      // Check stored permission state
      const result = await chrome.storage.local.get(['microphonePermissionGranted']);
      if (result.microphonePermissionGranted) {
        setPermissionGranted(true);
      }
    } catch (error) {
      console.error('Error checking permission status:', error);
    }
  };

  /**
   * Open permissions page in new tab
   */
  const openPermissionsPage = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('permissions.html'),
      active: true
    });
  };

  /**
   * Handle voice input button click
   */
  const handleVoiceInput = async () => {
    if (!isSupported) {
      setError('Speech recognition is not supported');
      return;
    }

    if (isListening) {
      // Stop listening
      sttRef.current.stopListening();
      setIsListening(false);
      return;
    }

    // Check if permission is granted
    if (permissionGranted !== true) {
      setError('Please grant microphone permission first by clicking the "Grant Permission" button.');
      return;
    }

    // Clear previous state
    setTranscript('');
    setError(null);
    setLastCommand(null);

    // Start listening
    sttRef.current.startListening(
      (text, isFinal) => {
        setTranscript(text);

        if (isFinal) {
          // Parse command when final transcript received
          const command = parserRef.current.parse(text);

          if (command) {
            setLastCommand(command);

            if (command.action === 'unknown') {
              setError(`I didn't understand: "${text}"`);
              speakResponse("I didn't understand that command.");
            } else {
              // Valid command - execute it
              const description = parserRef.current.getCommandDescription(command);
              setError(null);

              // Check if command requires confirmation
              if (parserRef.current.requiresConfirmation(command)) {
                speakResponse(`Preparing to ${description}. Please confirm in the wallet.`);
              } else {
                speakResponse(description);
              }

              // Execute command
              onCommand(command.action, command.params);
            }
          }

          // Stop listening after final result
          sttRef.current.stopListening();
          setIsListening(false);
        }
      },
      (error) => {
        setError(error);
        setIsListening(false);

        if (error.includes('no-speech')) {
          speakResponse("I didn't hear anything. Please try again.");
        } else if (error.includes('not-allowed')) {
          setPermissionGranted(false);
          setError(
            'Microphone access denied. Click the camera/microphone icon in your browser address bar, select "Allow", then try again.'
          );
        }
      },
      {
        continuous: false,
        interimResults: true,
        language: 'en-US',
      }
    );
  };

  /**
   * Speak response using TTS (if supported and enabled)
   * Uses ElevenLabs with hardcoded voiceId 8DzKSPdgEQPaK5vKG0Rs (publicly trackable)
   */
  const speakResponse = (text: string) => {
    // Always try ElevenLabs first with hardcoded voiceId
    elevenLabsTTSRef.current.speak(
      text,
      {
        // VoiceId 8DzKSPdgEQPaK5vKG0Rs is hardcoded - publicly trackable, not a secret
        stability: 0.5,
        similarityBoost: 0.75,
      },
      undefined,
      (error) => {
        console.error('ElevenLabs TTS error:', error);
        // Fallback to Web Speech API on error
        if (VoiceTTS.isSupported()) {
          ttsRef.current.speak(text, { lang: 'en-US' });
        }
      }
    );
  };

  /**
   * Stop any ongoing speech
   */
  const handleStopSpeech = () => {
    ttsRef.current.stop();
    elevenLabsTTSRef.current.stop();
  };

  if (!isEnabled) {
    return null;
  }

  return (
    <div className="voice-panel">
      <div className="voice-panel-header">
        <h3>🎤 Voice Commands</h3>
        {!isSupported && (
          <div className="voice-error">
            Speech recognition not supported in this browser
          </div>
        )}
        {isSupported && permissionGranted === false && (
          <div className="voice-warning">
            ⚠️ Microphone permission required
          </div>
        )}
        {isSupported && permissionGranted === true && (
          <div className="voice-success">
            ✅ Microphone ready
          </div>
        )}
      </div>

      <div className="voice-panel-content">
        {/* Show permission button if permission not granted */}
        {isSupported && permissionGranted !== true && (
          <button
            className="voice-permission-button"
            onClick={openPermissionsPage}
            title="Open permissions page to grant microphone access"
          >
            🔓 Grant Microphone Permission
          </button>
        )}

        <button
          className={`voice-button ${isListening ? 'listening' : ''}`}
          onClick={handleVoiceInput}
          disabled={!isSupported || permissionGranted !== true}
          title={
            permissionGranted !== true
              ? 'Grant microphone permission first'
              : isListening
              ? 'Stop listening'
              : 'Start listening'
          }
        >
          {isListening ? (
            <>
              <span className="pulse"></span>
              🎤 Listening...
            </>
          ) : (
            '🎤 Tap to Speak'
          )}
        </button>

        {transcript && (
          <div className="voice-transcript">
            <div className="transcript-label">You said:</div>
            <div className="transcript-text">"{transcript}"</div>
          </div>
        )}

        {lastCommand && lastCommand.action !== 'unknown' && (
          <div className="voice-command">
            <div className="command-label">Command:</div>
            <div className="command-text">
              {parserRef.current.getCommandDescription(lastCommand)}
            </div>
            <div className="command-confidence">
              Confidence: {Math.round(lastCommand.confidence * 100)}%
            </div>
          </div>
        )}

        {error && (
          <div className="voice-error">
            {error}
          </div>
        )}

        {((VoiceTTS.isSupported() && ttsRef.current.getIsSpeaking()) ||
          (useElevenLabs && elevenLabsTTSRef.current.getIsSpeaking())) && (
          <button
            className="voice-stop-button"
            onClick={handleStopSpeech}
          >
            🔇 Stop Speech
          </button>
        )}
      </div>

      <div className="voice-panel-help">
        <details>
          <summary>Available Commands</summary>
          <ul>
            <li>"What's my balance?"</li>
            <li>"Show my address"</li>
            <li>"Send 0.1 SOL to [address]"</li>
            <li>"Refresh balance"</li>
            <li>"Copy my address"</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
