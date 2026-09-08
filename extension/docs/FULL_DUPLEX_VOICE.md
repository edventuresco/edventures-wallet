# Full Duplex Voice Conversation Implementation

This document describes the full duplex voice conversation system with barge-in capabilities for My Little Wallet.

## Overview

The full duplex voice system enables natural, phone-call-like conversations with the wallet's AI assistant (Cristel). Users can speak freely and interrupt the AI at any time (barge-in), creating a more natural conversational UX.

## Architecture

### Core Components

1. **ConversationStateMachine** (`conversation-state.ts`)
   - Manages conversation flow states: IDLE, LISTENING, THINKING, SPEAKING, BARGE_IN
   - Validates state transitions
   - Tracks state history
   - Triggers callbacks on state changes

2. **AudioCapture** (`audio-capture.ts`)
   - Captures microphone audio with Acoustic Echo Cancellation (AEC)
   - Enables noise suppression and auto gain control
   - Converts Float32 audio to PCM16 format for ElevenLabs
   - Provides voice activity detection (VAD)

3. **ElevenLabsSTT** (`elevenlabs-realtime.ts`)
   - WebSocket client for ElevenLabs Realtime Speech-to-Text
   - Streams audio chunks to ElevenLabs
   - Receives partial and final transcripts
   - Handles connection lifecycle

4. **ElevenLabsTTS** (`elevenlabs-realtime.ts`)
   - WebSocket client for ElevenLabs Streaming Text-to-Speech
   - Streams text input to TTS
   - Receives and plays audio chunks
   - Supports immediate stop for barge-in

5. **BargeInDetector** (`barge-in-detector.ts`)
   - Detects when user interrupts AI speech
   - Uses both energy-based VAD and transcript analysis
   - Configurable thresholds and debouncing
   - Triggers barge-in events with confidence scores

6. **FullDuplexCoordinator** (`full-duplex-coordinator.ts`)
   - Orchestrates all components
   - Manages audio pipeline: mic → STT → AI → TTS → speakers
   - Coordinates barge-in detection and handling
   - Provides unified API for React components

7. **FullDuplexVoicePanel** (`FullDuplexVoicePanel.tsx`)
   - React UI component
   - Displays conversation state
   - Shows real-time transcripts and responses
   - Visualizes voice activity with energy meter
   - Tracks barge-in events

## How It Works

### Audio Pipeline

```
Microphone (AEC enabled)
    ↓
AudioCapture (Float32 PCM)
    ↓
Convert to PCM16 Base64
    ↓
ElevenLabsSTT WebSocket
    ↓
Transcript Events (partial + final)
    ↓
User Utterance Complete
    ↓
[Your LLM/Agent Processing]
    ↓
Stream Response Text
    ↓
ElevenLabsTTS WebSocket
    ↓
Audio Chunks
    ↓
AudioContext Playback
    ↓
Speakers
```

### Barge-In Flow

```
SPEAKING state + User speaks
    ↓
BargeInDetector monitors:
  - Audio energy levels
  - STT partial transcripts
    ↓
Threshold exceeded
    ↓
Trigger BARGE_IN state
    ↓
Stop TTS playback immediately
    ↓
Clear audio queue
    ↓
Transition to LISTENING
    ↓
Continue capturing user input
```

### State Transitions

```
IDLE
  ↓ start()
LISTENING (mic streaming)
  ↓ final transcript
THINKING (processing)
  ↓ response ready
SPEAKING (TTS playing)
  ↓ user interrupts
BARGE_IN
  ↓ handled
LISTENING
```

## Setup

### 1. Get ElevenLabs API Key

1. Sign up at https://elevenlabs.io
2. Navigate to Profile → API Keys
3. Generate a new API key

### 2. Configure Environment

Add to `.env`:

```bash
# ElevenLabs Configuration
VITE_ELEVENLABS_API_KEY=your_api_key_here

# Optional: Custom voice ID (default: Rachel)
VITE_ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Optional: Model (default: eleven_multilingual_v2)
VITE_ELEVENLABS_MODEL=eleven_multilingual_v2

# Optional: Enable debug logging
VITE_DEBUG_MODE=true
```

### 3. Integration

#### Option A: Replace Existing VoicePanel

In `popup.tsx`:

```tsx
import { FullDuplexVoicePanel } from './components/FullDuplexVoicePanel';

// Replace VoicePanel with FullDuplexVoicePanel
<FullDuplexVoicePanel
  onCommand={handleVoiceCommand}
  isEnabled={true}
/>
```

#### Option B: Add Toggle Switch

```tsx
const [useFullDuplex, setUseFullDuplex] = useState(false);

{useFullDuplex ? (
  <FullDuplexVoicePanel onCommand={handleVoiceCommand} isEnabled={true} />
) : (
  <VoicePanel onCommand={handleVoiceCommand} isEnabled={true} />
)}

<button onClick={() => setUseFullDuplex(!useFullDuplex)}>
  {useFullDuplex ? 'Use Legacy Voice' : 'Use Full Duplex'}
</button>
```

## Configuration

### BargeInDetector Tuning

Adjust sensitivity in `full-duplex-coordinator.ts`:

```typescript
this.bargeInDetector = new BargeInDetector({
  energyThreshold: 0.02,    // Voice energy threshold (0.0-1.0)
  minTranscriptLength: 3,   // Min characters before barge-in
  debounceMs: 300,          // Debounce window (ms)
  vadWindowMs: 200,         // VAD analysis window (ms)
});
```

### Audio Capture Settings

Adjust in `full-duplex-coordinator.ts`:

```typescript
await this.audioCapture.startCapture(
  (chunk) => this.handleAudioChunk(chunk),
  {
    sampleRate: 16000,         // 16kHz for STT
    channelCount: 1,           // Mono
    echoCancellation: true,    // Critical for duplex
    noiseSuppression: true,    // Improve quality
    autoGainControl: true,     // Normalize volume
  }
);
```

## Testing

### Manual Testing Checklist

- [ ] Start conversation - mic activates
- [ ] Speak - transcript appears in real-time
- [ ] Stop speaking - AI responds
- [ ] Interrupt AI mid-sentence - barge-in triggers
- [ ] AI stops immediately when interrupted
- [ ] No feedback loop (TTS doesn't echo back to STT)
- [ ] Energy meter shows voice activity
- [ ] State transitions are smooth
- [ ] Error handling works (API key missing, etc.)

### Browser Support

**Required:**
- Modern browser with WebAudio API support
- Microphone access permission
- WebSocket support

**Tested:**
- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

## Troubleshooting

### Issue: Feedback Loop (Echo)

**Cause:** TTS audio being picked up by microphone and re-transcribed

**Solutions:**
1. Ensure `echoCancellation: true` in audio capture settings
2. Lower speaker volume
3. Use headphones during testing
4. Increase barge-in `energyThreshold` to avoid false positives

### Issue: No Barge-In

**Cause:** Thresholds too high or detector not active

**Solutions:**
1. Lower `energyThreshold` (try 0.01)
2. Lower `minTranscriptLength` (try 1 or 2)
3. Check that `bargeInEnabled: true`
4. Verify state is SPEAKING when you interrupt

### Issue: ElevenLabs Connection Fails

**Cause:** API key or WebSocket URL issues

**Solutions:**
1. Verify `VITE_ELEVENLABS_API_KEY` is set
2. Check console for WebSocket errors
3. Ensure API key has correct permissions
4. Check ElevenLabs account status/credits

### Issue: High Latency

**Cause:** Network, processing, or buffer sizes

**Solutions:**
1. Reduce audio buffer size (but may increase CPU)
2. Use lower quality TTS model if available
3. Check network connection quality
4. Reduce text streaming chunk size

## Performance Considerations

### Token/Credit Usage

- **STT:** ~$0.006 per minute
- **TTS:** ~$0.30 per 1000 characters

Full conversation costs depend on:
- Conversation duration
- Response length
- Barge-in frequency (cancelled TTS saves credits)

### Resource Usage

- **CPU:** Moderate (audio processing + WebSocket management)
- **Memory:** ~10-20MB (audio buffers)
- **Network:** Continuous bidirectional streaming

### Optimization Tips

1. Use `debounceMs` to prevent excessive barge-in triggers
2. Implement conversation timeouts to avoid endless sessions
3. Batch short responses instead of streaming every word
4. Cache common responses client-side
5. Implement rate limiting for API calls

## Future Enhancements

### Planned Features

- [ ] Multi-language support (detect and switch)
- [ ] Voice activity visualization (waveform)
- [ ] Conversation history/replay
- [ ] Custom wake word detection
- [ ] Emotion detection in voice
- [ ] Voice biometric security
- [ ] Offline mode with local STT/TTS fallback
- [ ] Integration with wallet commands (beyond transcript parsing)

### Advanced Features

- [ ] Multi-party conversations
- [ ] Voice shortcuts/macros
- [ ] Contextual awareness (conversation memory)
- [ ] Adaptive barge-in (learn user patterns)
- [ ] Background noise filtering (ML-based)

## API Reference

### FullDuplexCoordinator

```typescript
class FullDuplexCoordinator {
  constructor(config: FullDuplexConfig, callbacks: FullDuplexCallbacks)

  async start(): Promise<void>
  stop(): void

  speakResponse(text: string): void

  getState(): ConversationState
  getIsRunning(): boolean
  getCurrentEnergy(): number
}
```

### ConversationStateMachine

```typescript
class ConversationStateMachine {
  getState(): ConversationState
  transition(to: ConversationState, reason?: string): boolean

  is(state: ConversationState): boolean
  isSpeaking(): boolean
  isListening(): boolean
  isThinking(): boolean
  isBargedIn(): boolean

  getTimeInCurrentState(): number
  getHistory(): StateTransition[]
  reset(): void
}
```

### BargeInDetector

```typescript
class BargeInDetector {
  setBargeInCallback(callback: (event: BargeInEvent) => void): void

  processAudioChunk(audioData: Float32Array): void
  processTranscript(event: TranscriptEvent): void
  processCombined(audioData: Float32Array, transcript: TranscriptEvent): void

  reset(): void
  getPartialTranscript(): string
  getCurrentEnergy(): number
  isActive(): boolean
}
```

## License

MIT - See LICENSE file for details

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
