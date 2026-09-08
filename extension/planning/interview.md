# Interview Transcript

## Interview Questions (minimal, judge-friendly)

1. What is the project name + 1-sentence pitch?
2. Who is the user and what problem are we solving?
3. What's the "wow" demo in 60 seconds?
4. What's the success criteria for judging? (3–5 bullets)
5. What is explicitly out of scope?
6. What tech constraints? (language, frameworks, time, hosting)
7. What are the top 3 risks?
8. What must be done first today?

---

## Interview Transcript (Append-Only)

### Session 2026-01-24

**Q: What is the project name + 1-sentence pitch?**
A: My Little Wallet - An LLM-first browser extension wallet that uses generative UI components to provide an intelligent, conversational crypto wallet experience.

**Q: Who is the user and what problem are we solving?**
A: Crypto users who find traditional wallet interfaces overwhelming and want a more intuitive, AI-guided experience for managing their digital assets.

**Q: What's the "wow" demo in 60 seconds?**
A: User opens the extension, asks in natural language "show me my Bitcoin balance", the LLM generates a beautiful UI component on-the-fly displaying the balance with insights and suggested actions.

**Q: What's the success criteria for judging?**
- LLM successfully interprets user requests and generates appropriate UI components
- Extension integrates with at least one blockchain (e.g., Bitcoin, Ethereum)
- Clean, working demo of conversational wallet interactions
- Code is well-structured and follows the prompt-led development methodology
- Clear audit trail in git history showing prompt → implementation flow

**Q: What is explicitly out of scope?**
- Multi-chain support (focus on one blockchain initially)
- Advanced DeFi integrations
- Mobile app version
- Production-ready security hardening (hackathon POC only)

**Q: What tech constraints?**
- Language: TypeScript/JavaScript for browser extension
- Framework: React for UI components
- LLM: Integration with Claude or similar API
- Time: Hackathon timeframe
- Hosting: Browser extension (Chrome/Firefox compatible)

**Q: What are the top 3 risks?**
1. LLM API latency affecting user experience
2. Complexity of blockchain integration within timeframe
3. Browser extension security model limitations

**Q: What must be done first today?**
1. Set up project structure with manifest.json for browser extension
2. Create basic LLM integration scaffold
3. Implement simple generative UI component system
4. Test end-to-end flow with a single use case
