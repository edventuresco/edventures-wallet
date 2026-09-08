# Voice Agent Improvements - 2026-01-24

## Issues Fixed

### 1. Multiple Text Outputs (Output Lock Timing)

**Problem:** AI voice was being transcribed by STT as duplicate user input, causing multiple responses.

**Root Cause:** Output lock was released when audio queue emptied, but audio was still playing in browser's audio pipeline. Microphone picked up the AI's voice while speaking.

**Solution:**
- Added `isStreamComplete` flag to track when ElevenLabs sends `{isFinal: true}`
- Added `playbackStartTime` to track total playback duration
- Modified `playNextChunk()` to only fire `onPlaybackComplete()` when BOTH:
  - Stream is complete (all chunks received)
  - Queue is empty (all chunks played)
- Reset state on new text and stop()

**Files Changed:**
- `src/services/elevenlabs-realtime.ts`

**Expected Behavior:**
```
[ElevenLabsTTS] Stream complete - all audio chunks received
[ElevenLabsTTS] Playing audio chunk (1.72s)... [0 remaining in queue]
[ElevenLabsTTS] Audio chunk finished
[ElevenLabsTTS] ✅ Playback complete - all audio played (8500ms total)
[FullDuplex] 🔊 Playback complete
[FullDuplex] 🔓 OUTPUT LOCK RELEASED
```

---

### 2. Verbose Responses & Missing Tool Usage

**Problem:**
- Agent giving long, verbose responses (50+ words) for voice
- Agent asking for information instead of using tools
- Example: "Great! Just share with me the Solana address..." instead of opening send dialog

**Root Cause:**
- Tools were being passed from coordinator but ignored by RPC handler
- Agent used `functionRegistry.getTools()` (empty) instead of passed tools
- System prompt not optimized for voice mode
- No distinction between voice and text responses

**Solution:**

1. **Fixed Tool Passing:**
```typescript
// RPC handler now accepts and passes tools
async function handleAgentChat(params: {
  message: string;
  mode?: 'voice' | 'text';
  tools?: any[]  // ✅ Now accepted
}): Promise<any> {
  // ...
  const response = await coordinator.processMessage(
    params.message,
    params.mode || 'text',
    params.tools  // ✅ Passed to coordinator
  );
}
```

2. **Agent Uses Passed Tools:**
```typescript
async processMessage(text: string, mode: 'voice' | 'text' = 'text', externalTools?: any[]) {
  // Prefer external tools (from voice UI) over registry
  const tools = externalTools && externalTools.length > 0
    ? externalTools
    : functionRegistry.getTools();
}
```

3. **Voice-Specific System Prompt:**
```typescript
private createVoiceSystemPrompt(): string {
  return `You are Cristel, a friendly Solana wallet voice assistant.

VOICE MODE RULES:
- Keep ALL responses under 2 sentences (max 20 words)
- Use contractions (you're, I'll, we'll)
- Skip explanations unless asked
- Be direct and actionable

AVAILABLE TOOLS - USE THESE INSTEAD OF ASKING FOR INFO:
- open_send_money: Opens send dialog (don't ask for address/amount, just open it)
- get_balance: Get current SOL balance
- get_address: Get wallet address
- copy_address: Copy address to clipboard
- refresh_balance: Refresh balance from blockchain

EXAMPLES:
❌ BAD: "Great! Just share with me the Solana address..."
✅ GOOD: "Opening send screen for you!"  [call open_send_money]

❌ BAD: "You currently have 0.146 SOL in your wallet, which is..."
✅ GOOD: "You have 0.15 SOL."  [after calling get_balance]
`;
}
```

**Files Changed:**
- `src/background/rpc.ts` - Accept and pass tools parameter
- `src/services/agent-coordinator.ts` - Use passed tools, voice-specific prompt

---

## Testing

### Test Case 1: Send Money Command
**User says:** "Send money" or "I want to send SOL"

**Expected:**
- Short response: "Opening send screen!"
- Tool call: `open_send_money({})`
- Send dialog appears

### Test Case 2: Balance Query
**User says:** "How much money do I have?" or "What's my balance?"

**Expected:**
- Tool call: `get_balance()`
- Short response: "You have 0.15 SOL."
- No asking for information

### Test Case 3: Get Address
**User says:** "What's my address?" or "Show my address"

**Expected:**
- Tool call: `get_address()`
- Short response: "Your address is AXdg..."

### Test Case 4: No Duplicate Outputs
**User says:** Any query

**Expected:**
- Single voice response
- Lock held until audio completely finishes
- No AI voice transcribed as user input
- Console shows proper lock timing

---

## Console Verification

**Good Output Lock Sequence:**
```
[FullDuplex] 🔒 OUTPUT LOCK ACQUIRED: "You have 0.15 SOL."
[FullDuplex] State: THINKING -> SPEAKING (AI response ready)
[ElevenLabsTTS] Stream complete - all audio chunks received
[ElevenLabsTTS] Playing audio chunk (1.72s)... [2 remaining in queue]
[ElevenLabsTTS] Audio chunk finished
[ElevenLabsTTS] Playing audio chunk (1.72s)... [1 remaining in queue]
[ElevenLabsTTS] Audio chunk finished
[ElevenLabsTTS] Playing audio chunk (1.72s)... [0 remaining in queue]
[ElevenLabsTTS] Audio chunk finished
[ElevenLabsTTS] ✅ Playback complete - all audio played (5160ms total)
[FullDuplex] 🔊 Playback complete
[FullDuplex] 🔓 OUTPUT LOCK RELEASED
[FullDuplex] State: SPEAKING -> LISTENING (AI finished speaking)
```

**Tool Usage:**
```
[Agent] Tools passed: 5
[AgentCoordinator] Using 5 tools for voice mode
[FullDuplex] 🔧 Processing 1 tool calls
[FullDuplex] 🔧 Executing tool: open_send_money
[FullDuplex] ✅ Tool executed successfully: open_send_money
```

---

## Summary

### Before:
- ❌ Multiple duplicate voice outputs
- ❌ Long, verbose responses (50+ words)
- ❌ Agent asking for information instead of using tools
- ❌ Tools ignored by RPC layer

### After:
- ✅ Single output per response (lock timing fixed)
- ✅ Concise responses (under 20 words)
- ✅ Direct tool usage (opens dialogs, gets data)
- ✅ Tools properly passed and used

### Impact:
- Voice UX is now fast and natural
- No duplicate audio playback
- Agent takes action instead of asking questions
- Responses are brief and conversational
