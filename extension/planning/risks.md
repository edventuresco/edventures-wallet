# Risks and Mitigation

## Top Risks

### 1. LLM API Latency Affecting User Experience
**Severity**: High
**Probability**: Medium
**Impact**: Users may perceive the extension as slow or unresponsive

**Mitigation Strategies**:
- Implement optimistic UI with loading states
- Cache LLM responses for common queries
- Use streaming responses if API supports it
- Set reasonable timeout (5s) with fallback UI
- Show skeleton components while waiting
- Consider lighter model for faster responses

**Fallback Plan**:
- Pre-defined UI templates for common queries
- Local intent classification for instant responses
- Graceful degradation to simple UI if API fails

### 2. Complexity of Blockchain Integration Within Timeframe
**Severity**: High
**Probability**: Medium
**Impact**: May not complete full blockchain integration in hackathon timeframe

**Mitigation Strategies**:
- Start with simplest blockchain (Bitcoin for balance query)
- Use well-tested library (web3.js or ethers.js)
- Focus on read-only operations only
- Use public RPC endpoints (Infura, Alchemy)
- Mock blockchain responses for UI development
- Parallel development tracks (UI + blockchain)

**Fallback Plan**:
- Demo with mocked blockchain data
- Document integration path for post-hackathon
- Focus on LLM + generative UI if blockchain blocked

### 3. Browser Extension Security Model Limitations
**Severity**: Medium
**Probability**: Low
**Impact**: Security restrictions may limit functionality or complicate architecture

**Mitigation Strategies**:
- Use Manifest V3 from the start
- All API calls through background service worker
- Strict Content Security Policy compliance
- No eval() or unsafe practices
- Test in actual browser environment early
- Review Chrome extension docs for CSP rules

**Fallback Plan**:
- Simplify architecture to work within constraints
- Use message passing for all external communication
- Accept read-only limitations for MVP

## Secondary Risks

### 4. API Key Management in Browser Extension
**Severity**: Medium
**Probability**: Medium
**Impact**: Exposing API keys or poor UX for key entry

**Mitigation**:
- Use chrome.storage.local (encrypted by browser)
- Settings UI for users to input their own keys
- Clear documentation on API key security
- Never commit keys to repository
- Environment variables for development

### 5. Browser Compatibility Issues
**Severity**: Low
**Probability**: Low
**Impact**: Extension may not work in all target browsers

**Mitigation**:
- Target Chrome first (largest market)
- Use web extension polyfill for Firefox
- Test in both Chrome and Firefox
- Document browser requirements clearly

### 6. LLM Hallucination or Incorrect UI Generation
**Severity**: Medium
**Probability**: Medium
**Impact**: LLM may generate inappropriate or broken UI schemas

**Mitigation**:
- Strict schema validation before rendering
- Whitelist of allowed component types
- Sanitize all user-facing content
- Error boundaries in React
- Comprehensive prompt engineering
- Fallback to safe default UI

### 7. Scope Creep During Hackathon
**Severity**: Medium
**Probability**: High
**Impact**: May not complete core demo functionality

**Mitigation**:
- Strict adherence to M0 milestones
- Timeboxed development sprints
- Clear acceptance criteria for "done"
- Defer nice-to-haves to M1/M2
- Focus on one complete user flow

## Risk Monitoring

- Review risks daily during hackathon
- Adjust scope based on progress
- Communicate blockers immediately
- Document decisions in planning/decisions.md
- Pivot strategy if high-severity risks materialize
