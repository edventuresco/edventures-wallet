# Milestones

## M0 — Demo Spine (Must Work)

### Browser Extension Foundation
- [ ] Create manifest.json for Chrome/Firefox compatibility
  Done when: Extension loads in browser without errors

- [ ] Set up basic popup HTML structure
  Done when: Popup opens when clicking extension icon

- [ ] Configure background service worker
  Done when: Service worker registers and runs

- [ ] Implement secure storage wrapper
  Done when: Can save/retrieve settings from chrome.storage

### LLM Integration
- [ ] Set up LLM API client (Claude/OpenAI)
  Done when: Can send request and receive response

- [ ] Create message handler for natural language input
  Done when: User input is sent to LLM and response is received

- [ ] Implement response parsing system
  Done when: LLM responses are parsed into structured data

### Generative UI System
- [ ] Build dynamic component renderer
  Done when: Can render React components from JSON schema

- [ ] Create base UI component library
  Done when: Balance display, transaction list, and error components exist

- [ ] Implement component styling system
  Done when: Components render with consistent, modern design

### Blockchain Integration
- [ ] Choose and integrate blockchain library (web3.js or similar)
  Done when: Library is installed and configured

- [ ] Implement balance fetching
  Done when: Can retrieve and display wallet balance

- [ ] Implement transaction history fetching
  Done when: Can retrieve and display recent transactions

### End-to-End Flow
- [ ] Test complete user journey
  Done when: User can ask "show my balance" and see generated UI with real data

## M1 — Quality

### Error Handling
- [ ] Add LLM error handling and fallbacks
  Done when: Extension gracefully handles API failures

- [ ] Add blockchain error handling
  Done when: Network errors show user-friendly messages

- [ ] Add input validation
  Done when: Invalid inputs are caught before processing

### Testing
- [ ] Unit tests for core utilities
  Done when: Key functions have test coverage

- [ ] Integration test for LLM flow
  Done when: Can verify LLM request/response cycle

- [ ] Manual test suite documentation
  Done when: Test cases are documented in /planning

### Documentation
- [ ] Add inline code documentation
  Done when: Complex functions have JSDoc comments

- [ ] Create architecture diagram
  Done when: Visual representation of system in planning/architecture.md

- [ ] Write deployment/installation guide
  Done when: README has clear setup instructions

## M2 — Polish

### User Experience
- [ ] Add loading states and animations
  Done when: Users see feedback during async operations

- [ ] Improve visual design
  Done when: UI feels modern and professional

- [ ] Add helpful empty states
  Done when: First-time users see helpful guidance

### Advanced Features
- [ ] Support multiple query types
  Done when: Can handle balance, transactions, and help requests

- [ ] Add conversation history
  Done when: Previous queries are saved and accessible

- [ ] Implement settings panel
  Done when: Users can configure API keys and preferences

### Performance
- [ ] Optimize component rendering
  Done when: UI updates feel instant

- [ ] Add response caching
  Done when: Repeated queries use cached data

- [ ] Minimize bundle size
  Done when: Extension loads quickly
