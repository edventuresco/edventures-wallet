# Feature Requirement Document: Voice Agent Tool System

## Feature Name
Voice Agent Tool Calling and Event System

## Goal
Enable the voice agent (ElevenLabs conversational AI) to interact with the wallet UI by calling tools (e.g., "open send money dialog") and receiving events when user actions occur (e.g., when attempting to send funds). This creates a bidirectional communication channel between the AI agent and the wallet interface.

## User Story
As a wallet user, I want to ask my voice agent to perform wallet actions (like "send money to Alice"), so that I can interact with my wallet hands-free through natural conversation.

## Functional Requirements

### 1. Tool Registration System
- Agent must have access to a registry of callable tools/functions
- Each tool must have:
  - Unique identifier (e.g., "open_send_money", "show_balance")
  - Description for the AI to understand when to use it
  - Parameter schema defining required/optional inputs
  - Handler function that executes the actual UI action

### 2. Tool Invocation from Agent
- Agent receives tool definitions during conversation setup
- Agent can request tool execution via structured messages
- System validates tool calls and parameters
- System executes tool handlers and returns results to agent

### 3. Event Broadcasting to Agent
- Wallet UI actions trigger events that flow back to agent
- Events include:
  - User initiating send transaction
  - Transaction confirmation/cancellation
  - Balance updates
  - Navigation changes
  - Error states
- Agent receives events as conversation context updates

### 4. UI Controls in Popup
- Add button to trigger voice agent mode
- Visual indicator when agent is listening/speaking
- Controls to enable/disable specific agent capabilities
- Display of current agent context/state

### 5. Context Management
- Agent maintains conversation context across tool calls
- Context includes current view, selected assets, pending actions
- Context updates when UI state changes
- Context shared between agent and UI state management

## Data Requirements

### Tool Definition Schema
```typescript
interface AgentTool {
  name: string;              // e.g., "open_send_money"
  description: string;       // For AI understanding
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
  };
  handler: (params: any) => Promise<any>;
}
```

### Event Schema
```typescript
interface AgentEvent {
  type: string;              // e.g., "send_initiated", "balance_updated"
  timestamp: number;
  data: Record<string, any>; // Event-specific payload
  context?: Record<string, any>; // Current UI context
}
```

## User Flow

### Primary Flow: Voice-Initiated Send
1. User clicks voice agent button in popup
2. Agent enters listening mode (visual indicator shown)
3. User says: "Send 10 USDC to Alice"
4. Agent processes speech and identifies tool: `open_send_money`
5. Agent calls tool with parameters: `{ amount: 10, asset: "USDC", recipient: "Alice" }`
6. Tool handler opens send dialog with pre-filled fields
7. Send dialog broadcasts `send_dialog_opened` event to agent
8. User reviews and confirms/cancels transaction
9. UI broadcasts `send_confirmed` or `send_cancelled` event
10. Agent acknowledges action: "I've sent 10 USDC to Alice" or "Transaction cancelled"

### Secondary Flow: Agent Query
1. User asks: "What's my balance?"
2. Agent calls `get_balance` tool
3. Tool returns current balances
4. Agent responds: "You have 150 USDC and 0.5 ETH"

## Acceptance Criteria

- [ ] Agent can receive and parse at least 3 tool definitions (open_send_money, get_balance, get_address)
- [ ] Agent successfully calls tools with correct parameters
- [ ] UI actions (send initiated, confirmed, cancelled) generate events
- [ ] Events are delivered to agent within 100ms
- [ ] Agent responds contextually to events (acknowledges actions)
- [ ] Popup UI has visible agent activation button
- [ ] Visual feedback shows agent listening/speaking states
- [ ] Tool execution errors are handled gracefully with user feedback
- [ ] Agent maintains context across multiple tool calls in single conversation

## Edge Cases

1. **Tool Call with Invalid Parameters**
   - Agent requests tool with missing/wrong parameters
   - System validates and returns error to agent
   - Agent rephrases or asks user for clarification

2. **Concurrent Tool Calls**
   - Agent attempts multiple tool calls simultaneously
   - System queues or rejects concurrent calls
   - Agent informed of execution order/rejection

3. **Event During Tool Execution**
   - User manually triggers action while tool is executing
   - System handles race condition gracefully
   - Agent receives both tool result and event

4. **Agent Disconnection During Action**
   - User initiates action, agent disconnects mid-flow
   - UI continues to function normally
   - Agent can resume context when reconnected

5. **Ambiguous Voice Commands**
   - User says "send money" without specifying amount/recipient
   - Agent uses tools to query context or asks follow-up questions
   - Agent guides user through required parameters

6. **Permissions and Security**
   - Agent cannot execute high-risk actions (large sends) without explicit confirmation
   - Tool execution requires user approval for sensitive operations
   - Agent cannot access private keys or signing capabilities

## Non-Functional Requirements

### Performance
- Tool execution latency: <200ms from agent request to UI response
- Event delivery latency: <100ms from UI action to agent notification
- Agent response time: <2s from event to verbal acknowledgment

### Security
- Tool calls validated against whitelist of permitted actions
- Sensitive operations require explicit user confirmation
- Agent cannot bypass wallet security (password, biometrics)
- All tool calls logged for audit

### Usability
- Clear visual feedback for agent state (idle, listening, speaking, processing)
- Error messages are user-friendly and actionable
- Agent responses are natural and conversational
- UI remains fully functional when agent is inactive

### Reliability
- Tool execution failures don't crash agent or UI
- Agent gracefully handles network interruptions
- System recovers from ElevenLabs service disruptions
- Event queue prevents message loss during brief disconnections

## Implementation Notes

### Key Components to Modify
- `src/services/elevenlabs-realtime.ts` - Add tool registration and event handling
- `src/services/full-duplex-coordinator.ts` - Coordinate tool calls with conversation flow
- `src/popup/popup.tsx` - Add agent button and UI controls
- `src/background/rpc.ts` - Expose wallet operations as agent tools

### Integration Points
- Use existing RPC infrastructure for tool handlers
- Leverage current event system for UI state changes
- Extend ElevenLabs client conversation config with tool definitions
- Use React context or state management for agent-UI synchronization

### Testing Strategy
- Unit tests for tool registration and validation
- Integration tests for tool execution flow
- E2E tests for complete voice-to-action scenarios
- Manual testing with various voice commands
