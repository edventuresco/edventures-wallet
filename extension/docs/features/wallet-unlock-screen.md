# Feature Requirement Document: Wallet Unlock Screen

## Feature Name
Wallet Unlock Screen

## Goal
Allow users to unlock their encrypted wallet with their password when the extension restarts or the wallet is in a locked state. This prevents the "Wallet is locked" error and enables users to access their wallet after browser restarts.

## User Story
As a **wallet user**, I want to **enter my password to unlock my wallet when it's locked**, so that I can **access my funds and sign transactions after the extension restarts**.

## Problem Statement
Currently, when the browser extension restarts (browser reload, extension update, etc.), the wallet's in-memory state is cleared and the wallet becomes "locked". The popup has no UI to unlock the wallet, resulting in a "Wallet is locked" error. Users cannot access their wallet until they reset it entirely, which is a critical UX failure.

## Functional Requirements

### FR1: Locked State Detection
- **FR1.1**: System MUST detect when wallet is initialized but locked
- **FR1.2**: System MUST distinguish between three states:
  - Not initialized (show onboarding)
  - Initialized but locked (show unlock screen)
  - Initialized and unlocked (show wallet main screen)
- **FR1.3**: Detection MUST happen on popup open via `checkWalletInitialized` + attempt to connect

### FR2: Unlock Screen UI
- **FR2.1**: Screen MUST display when wallet is locked
- **FR2.2**: Screen MUST include:
  - Header: "Welcome Back" or "Unlock Wallet"
  - Explanatory text: "Enter your password to unlock your wallet"
  - Password input field (type="password")
  - "Unlock" button
  - Error message display area
  - Link/button to "Forgot password?" (shows recovery instructions)
- **FR2.3**: Screen MUST follow existing design system (match onboarding screens)

### FR3: Unlock Functionality
- **FR3.1**: System MUST call `unlockWallet` RPC method with password
- **FR3.2**: System MUST handle successful unlock:
  - Clear any error messages
  - Load wallet and display public key
  - Navigate to main wallet screen
- **FR3.3**: System MUST handle unlock failure:
  - Display error message: "Invalid password. Please try again."
  - Keep password field visible for retry
  - Do NOT lock out after multiple attempts (no rate limiting in v1)
- **FR3.4**: System MUST validate password is not empty before RPC call

### FR4: State Management
- **FR4.1**: Add new `AppState.WALLET_UNLOCK` state to popup state machine
- **FR4.2**: Update `initializeApp()` flow:
  ```
  1. Check if initialized
  2. If not initialized → ONBOARDING_WELCOME
  3. If initialized → try connect
     - If connect succeeds → WALLET_MAIN
     - If connect fails with "Wallet is locked" → WALLET_UNLOCK
  ```
- **FR4.3**: After successful unlock → WALLET_MAIN

## Data Requirements

**No new storage required.** This feature uses existing:
- `STORAGE_KEYS.VAULT` (encrypted wallet, already exists)
- `unlockWallet` RPC method (already exists in rpc.ts)
- `unlock()` function in keyring (already exists)

## User Flow

### Happy Path
1. User opens browser after restart
2. User clicks extension icon
3. System detects wallet is initialized but locked
4. System displays unlock screen
5. User enters password
6. User clicks "Unlock" button
7. System calls `unlockWallet` RPC
8. System displays main wallet screen with public key

### Error Path - Wrong Password
1. Steps 1-6 same as happy path
2. System calls `unlockWallet` RPC
3. RPC returns error: "Invalid password"
4. System displays error message
5. User tries again with correct password
6. System unlocks and shows main wallet screen

### Forgot Password Path
1. Steps 1-4 same as happy path
2. User clicks "Forgot password?"
3. System shows message: "To recover your wallet, you must import your 12-word seed phrase. Click 'Reset Wallet' to start over."
4. User can choose to reset or cancel

## Acceptance Criteria

### AC1: Lock State Detection
- [ ] When extension restarts and user opens popup, system detects locked state
- [ ] System does NOT show onboarding for existing wallet
- [ ] System does NOT show "Wallet is locked" error in console

### AC2: Unlock Screen Display
- [ ] Unlock screen appears when wallet is locked
- [ ] Password field is visible and focusable
- [ ] Unlock button is present and clickable
- [ ] Screen matches design system of onboarding screens

### AC3: Successful Unlock
- [ ] Entering correct password unlocks wallet
- [ ] Main wallet screen displays with correct public key
- [ ] No errors in console after unlock
- [ ] User can copy address and interact with wallet

### AC4: Failed Unlock
- [ ] Entering wrong password shows error message
- [ ] Error message is clear: "Invalid password"
- [ ] User can retry without reloading
- [ ] Multiple failed attempts do NOT lock the account

### AC5: Forgot Password Flow
- [ ] "Forgot password?" link/button is visible
- [ ] Clicking it shows recovery instructions
- [ ] Instructions mention seed phrase recovery
- [ ] User can navigate back to unlock screen

## Edge Cases

### EC1: Empty Password
**Scenario**: User clicks unlock without entering password
**Behavior**: Show error "Password is required"

### EC2: Network/RPC Failure
**Scenario**: RPC call fails due to internal error
**Behavior**: Show error "Failed to unlock wallet. Please try again."

### EC3: Wallet Deleted During Unlock
**Scenario**: User has unlock screen open, deletes wallet in another tab
**Behavior**: Next unlock attempt shows "No wallet found"

### EC4: Multiple Popup Windows
**Scenario**: User opens multiple popup windows, unlocks in one
**Behavior**: Other windows should detect unlock and update (nice-to-have, not required for v1)

### EC5: Rapid Unlock Attempts
**Scenario**: User rapidly clicks unlock button multiple times
**Behavior**: Disable button during RPC call, ignore duplicate clicks

## Non-Functional Requirements

### NFR1: Performance
- Unlock operation MUST complete within 2 seconds for valid password
- Unlock screen MUST appear within 500ms of popup open

### NFR2: Security
- Password MUST NOT be logged to console
- Password field MUST use `type="password"`
- Password MUST NOT be stored in popup state after unlock
- Failed unlock MUST NOT reveal whether wallet exists

### NFR3: UX
- Error messages MUST be user-friendly (no technical jargon)
- Password field SHOULD autofocus on screen display
- Enter key SHOULD trigger unlock button
- Loading indicator SHOULD appear during unlock RPC call

### NFR4: Accessibility
- Password field MUST have proper label
- Error messages MUST be announced to screen readers
- Unlock button MUST be keyboard accessible

## Implementation Notes

### Files to Modify
- `src/popup/popup.tsx` - Add unlock screen state and UI
- `src/popup/popup.html` - Add unlock screen HTML structure
- `src/popup/popup.css` - Add unlock screen styles (if separate CSS exists)

### New AppState
```typescript
enum AppState {
  LOADING = "loading",
  ONBOARDING_WELCOME = "onboarding-welcome",
  ONBOARDING_PASSWORD = "onboarding-password",
  ONBOARDING_SEED = "onboarding-seed",
  ONBOARDING_COMPLETE = "onboarding-complete",
  WALLET_UNLOCK = "wallet-unlock", // NEW
  WALLET_MAIN = "wallet-main",
}
```

### Detection Logic
```typescript
async function initializeApp() {
  const response = await chrome.runtime.sendMessage({
    channel: "my-little-wallet",
    id: crypto.randomUUID(),
    method: "checkWalletInitialized",
  });

  if (response.ok && response.result.initialized) {
    // Try to connect to check if locked
    try {
      await loadWallet();
    } catch (error) {
      if (error.message.includes("locked")) {
        showScreen(AppState.WALLET_UNLOCK); // NEW
      } else {
        throw error;
      }
    }
  } else {
    showScreen(AppState.ONBOARDING_WELCOME);
  }
}
```

## Out of Scope (Future Enhancements)
- Auto-lock after timeout (future feature)
- Biometric unlock (future feature)
- Remember password for session (security risk, not implementing)
- Rate limiting / account lockout (future security enhancement)
- "Keep unlocked" checkbox (security risk, not implementing)
- Visual feedback for password strength (not needed for unlock)
- Multi-popup sync (complex, defer to v2)

## Dependencies
- Existing `unlockWallet` RPC method in `src/background/rpc.ts`
- Existing `unlock()` function in `src/background/keyring.ts`
- Existing onboarding UI design patterns

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Wrong password handling is unclear to user | Medium | Show clear error message, allow retry |
| Users forget password with no recovery | High | Add "Forgot password?" with seed phrase recovery instructions |
| RPC call fails, user stuck on unlock screen | Medium | Show error with retry button, add timeout |
| Unlock screen doesn't match design system | Low | Follow existing onboarding screen patterns |

## Success Metrics
- Users can successfully unlock wallet after browser restart
- Zero "Wallet is locked" errors in production
- Password error rate < 30% (indicates clear UX)

## Timeline Estimate
- Design: 0.5 hours (follow existing patterns)
- Implementation: 2-3 hours
- Testing: 1 hour
- Total: ~4 hours

## Approval Status
⏳ Awaiting user review and approval
