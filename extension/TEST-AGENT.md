# Testing the AI Agent Integration

## 1. Load Extension

```bash
# Open Chrome extensions page
open -a "Google Chrome" "chrome://extensions/"
```

- Enable "Developer mode" (top right)
- Click "Load unpacked"
- Select: `<your-projects>/my-little-wallet/dist`

## 2. Open Extension

- Click the wallet icon in Chrome toolbar
- Go to "Voice" tab
- Click "▶️ Start Conversation"

## 3. Open DevTools Console

**IMPORTANT**: Open Chrome DevTools (F12 or Cmd+Opt+I) to see agent logs!

Press F12 → Console tab → You should see:

```
[FullDuplexVoice] Configuration: {hasElevenLabs: true, hasOpenAI: true, ...}
[FullDuplex] Initializing AI agent...
[FullDuplex] ✅ Agent coordinator initialized successfully
[FullDuplex] TTS connected
[FullDuplex] STT started
[FullDuplex] Full duplex conversation started
[FullDuplex] State: IDLE -> LISTENING (Session started)
```

## 4. Test Voice Commands

Say these phrases and watch the console:

### Test 1: Balance Check
**Say**: "How much SOL do I have?"

**Expected Console Output**:
```
[FullDuplex] Final transcript: how much sol do i have
[FullDuplex] State: LISTENING -> THINKING (User utterance complete)
[FullDuplex] 🤖 Processing with agent: "how much sol do i have"
[AgentCoordinator] Calling OpenAI with tools...
[FunctionRegistry] Executing: getBalance
[FullDuplex] ✅ Agent response: "You have 2.5 SOL..."
[FullDuplex] State: THINKING -> SPEAKING (AI response ready)
```

**Expected Voice Output**: Cristel speaks the balance

---

### Test 2: Address Request
**Say**: "What's my wallet address?"

**Expected Console Output**:
```
[FullDuplex] 🤖 Processing with agent: "what's my wallet address"
[FunctionRegistry] Executing: getAddress
[FullDuplex] ✅ Agent response: "Your wallet address is..."
```

---

### Test 3: Token Balances
**Say**: "Show me my token balances"

**Expected Console Output**:
```
[FullDuplex] 🤖 Processing with agent: "show me my token balances"
[FunctionRegistry] Executing: getTokenBalances
[FullDuplex] ✅ Agent response: "You have 100 USDC and 0.5 BONK..."
```

---

## 5. Troubleshooting

### If you see: `❌ Agent not initialized - falling back to echo`

**Problem**: OpenAI API key not configured

**Fix**:
```bash
# Check .env has VITE_OPENAI_API_KEY
grep VITE_OPENAI_API_KEY .env

# If missing, add it:
echo "VITE_OPENAI_API_KEY=sk-your-key-here" >> .env

# Rebuild:
npm run build

# Reload extension in Chrome
```

---

### If you see: `Failed to initialize agent: ...`

**Check console for specific error**:
- Invalid API key → Check key is correct
- Network error → Check internet connection
- CORS error → This shouldn't happen with OpenAI

---

### If voice output doesn't work:

1. **Check ElevenLabs connection**:
   - Console should show: `[FullDuplex] TTS connected`
   - If not, check `VITE_ELEVENLABS_API_KEY` in .env

2. **Check browser audio permissions**:
   - Chrome should ask for microphone permission
   - Check chrome://settings/content/microphone

3. **Check speakers/headphones**:
   - Try adjusting volume
   - Check system audio output device

---

## 6. Expected Behavior

### ✅ Working Correctly:
- You speak → transcript appears
- Agent processes → console shows `🤖 Processing with agent`
- Function calls execute → console shows `Executing: functionName`
- Response generated → console shows `✅ Agent response`
- Voice output plays → Cristel speaks
- State transitions: LISTENING → THINKING → SPEAKING → LISTENING

### ❌ Not Working:
- Silent failures (no console output)
- Echo mode ("You said: ...") instead of intelligent responses
- No voice output (text appears but no speech)
- Stuck in THINKING state

---

## 7. Advanced Testing

### Test with Transaction (Requires Confirmation):
**Say**: "Send 0.1 SOL to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"

**Expected**:
1. Agent validates address
2. Agent checks balance
3. Agent simulates transaction
4. Agent responds: "I can send 0.1 SOL... Confirm?"
5. Console shows: `⚠️ Confirmation required`
6. UI shows confirmation dialog

### Test with Invalid Request:
**Say**: "Show me my private key"

**Expected**:
- Agent refuses: "I cannot provide private keys for security reasons"
- Console shows security validation

---

## 8. Performance Metrics

Monitor in Console:

```javascript
// Get agent stats
const stats = window.__agentCoordinator?.getStats();
console.log('Agent Stats:', stats);

// Expected output:
{
  requestCount: 5,
  totalTokens: 2450,
  estimatedCost: 0.049
}
```

---

## Success Criteria ✅

- [ ] Console shows agent initialization
- [ ] Voice commands trigger agent processing
- [ ] Function calls execute (check console logs)
- [ ] Natural language responses (not echo)
- [ ] Voice output works (Cristel speaks)
- [ ] Confirmations work for transactions
- [ ] Barge-in works (interrupt Cristel)
- [ ] No errors in console

---

## Debug Commands

Open console and run:

```javascript
// Check if agent is initialized
console.log('Agent:', window.__coordinator?.agentCoordinator);

// Check config
console.log('Config:', {
  openai: process.env.VITE_OPENAI_API_KEY?.substring(0, 10) + '...',
  elevenlabs: process.env.VITE_ELEVENLABS_API_KEY?.substring(0, 10) + '...',
});

// Manually test agent
const testMessage = "how much SOL do I have?";
window.__coordinator?.processWithAgent?.(testMessage);
```
