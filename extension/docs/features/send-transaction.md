# Feature Requirement Document: Send Transaction

**Feature Name:** Send Transaction

**Date:** 2026-01-24

**Status:** Planning

---

## Goal

Enable users to send SOL from their wallet to any Solana address with a secure, user-friendly flow that follows Backpack wallet best practices.

## User Story

As a wallet user, I want to send SOL to another address, so that I can transfer funds securely with clear visibility into transaction details and fees before confirmation.

## Functional Requirements

### FR1: Send Button Access
- **REQ-001**: A "Send" button SHALL be prominently displayed in the main wallet view
- **REQ-002**: The "Send" button SHALL be enabled only when wallet is unlocked and balance > 0
- **REQ-003**: Clicking "Send" SHALL open a send transaction form

### FR2: Transaction Form
- **REQ-004**: Form SHALL include recipient address input field (Solana public key)
- **REQ-005**: Form SHALL include amount input field (SOL amount with decimal support)
- **REQ-006**: Form SHALL display current wallet balance
- **REQ-007**: Form SHALL include "Max" button to auto-fill available balance minus estimated fees
- **REQ-008**: Form SHALL validate recipient address format (base58, 32-44 characters)
- **REQ-009**: Form SHALL validate amount is positive and <= available balance
- **REQ-010**: Form SHALL show real-time validation errors
- **REQ-011**: Form SHALL include "Review Transaction" button (disabled until valid)

### FR3: Transaction Simulation
- **REQ-012**: Before showing approval dialog, transaction SHALL be simulated using Solana RPC
- **REQ-013**: Simulation SHALL detect transaction errors (insufficient funds, invalid accounts, etc.)
- **REQ-014**: Simulation SHALL estimate transaction fee (compute units consumed)
- **REQ-015**: Simulation failures SHALL display user-friendly error messages
- **REQ-016**: Users SHALL NOT be allowed to proceed if simulation fails

### FR4: Approval Dialog
- **REQ-017**: Approval dialog SHALL display recipient address (truncated with full address on hover)
- **REQ-018**: Approval dialog SHALL display send amount in SOL
- **REQ-019**: Approval dialog SHALL display estimated transaction fee
- **REQ-020**: Approval dialog SHALL display total amount (send amount + fee)
- **REQ-021**: Approval dialog SHALL include "Approve" and "Reject" buttons
- **REQ-022**: Approval dialog SHALL have 2-minute timeout, auto-rejecting on timeout
- **REQ-023**: Closing the approval dialog SHALL reject the transaction

### FR5: Transaction Signing and Broadcast
- **REQ-024**: On approval, transaction SHALL be signed with user's private key
- **REQ-025**: Signed transaction SHALL be broadcast to Solana network
- **REQ-026**: Transaction signature SHALL be returned and logged
- **REQ-027**: Transaction SHALL be sent to the configured network (mainnet/devnet)

### FR6: Success/Failure Feedback
- **REQ-028**: Successful transactions SHALL display confirmation with transaction signature
- **REQ-029**: Transaction signature SHALL be clickable link to Solana Explorer
- **REQ-030**: Failed transactions SHALL display error message with reason
- **REQ-031**: Users SHALL be able to retry failed transactions
- **REQ-032**: Success confirmation SHALL auto-refresh wallet balance

### FR7: Error Handling
- **REQ-033**: Network errors SHALL display user-friendly messages
- **REQ-034**: Invalid address errors SHALL highlight the address field
- **REQ-035**: Insufficient balance errors SHALL suggest reducing amount
- **REQ-036**: Timeout errors SHALL allow retry
- **REQ-037**: All errors SHALL be logged to console for debugging

## Data Requirements

### Existing Data Used
- Wallet public key (from keyring)
- Wallet private key (for signing, background only)
- Current SOL balance (from Solana RPC)
- Solana RPC connection (from solana-rpc.ts)
- Network configuration (mainnet/devnet)

### New Data Required
- Transaction history (future: store sent transactions)
- Pending transaction state (for approval flow)

## User Flow

### Primary Flow: Send SOL Successfully
1. User opens wallet popup, sees balance and "Send" button
2. User clicks "Send" button
3. Send form appears with recipient address and amount fields
4. User enters recipient address (e.g., "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")
5. User enters amount (e.g., "0.5")
6. User clicks "Max" to auto-fill remaining balance minus fees (optional)
7. Form validates inputs in real-time (green checkmark if valid)
8. User clicks "Review Transaction"
9. System simulates transaction to estimate fees and check for errors
10. If simulation succeeds, approval dialog appears showing:
    - Recipient: 7xKX...gAsU (hover for full address)
    - Amount: 0.5 SOL
    - Fee: ~0.000005 SOL
    - Total: ~0.500005 SOL
11. User reviews details and clicks "Approve"
12. System signs transaction with private key
13. System broadcasts transaction to Solana network
14. Success confirmation appears with transaction signature and Explorer link
15. Wallet balance refreshes automatically

### Alternative Flow: Simulation Fails
1-9. Same as primary flow through simulation
10. Simulation detects error (e.g., insufficient funds after fees)
11. Error dialog appears: "Transaction would fail: Insufficient funds for transaction and fees. Try reducing the amount."
12. User clicks "OK"
13. Send form reappears with error highlighted
14. User adjusts amount and retries

### Alternative Flow: User Rejects Transaction
1-10. Same as primary flow through approval dialog
11. User clicks "Reject" or closes dialog
12. Transaction is cancelled
13. Send form remains open for editing
14. User can retry or click "Cancel" to return to main wallet

### Alternative Flow: Network Error
1-13. Same as primary flow through broadcast
14. Network request fails (timeout, RPC error)
15. Error message appears: "Failed to send transaction. Please check your connection and try again."
16. User can click "Retry" or "Cancel"

## Acceptance Criteria

### AC1: Send Button Integration
- [ ] "Send" button is visible in main wallet view
- [ ] Button is styled consistently with existing buttons
- [ ] Button is disabled when wallet locked or balance is 0

### AC2: Form Validation
- [ ] Invalid addresses show error message
- [ ] Amounts exceeding balance show error message
- [ ] Negative or zero amounts show error message
- [ ] Non-numeric amounts show error message
- [ ] "Max" button correctly calculates available balance minus estimated fees

### AC3: Transaction Simulation
- [ ] Transactions are simulated before approval dialog
- [ ] Simulation errors are caught and displayed
- [ ] Fee estimation is accurate within 10%
- [ ] Simulations complete within 3 seconds

### AC4: Approval Flow
- [ ] Approval dialog displays all required information
- [ ] Approve button signs and broadcasts transaction
- [ ] Reject button cancels transaction
- [ ] Dialog times out after 2 minutes
- [ ] Closing dialog cancels transaction

### AC5: Transaction Success
- [ ] Successful transactions return signature
- [ ] Transaction signature links to Solana Explorer
- [ ] Wallet balance updates after successful transaction
- [ ] Success message is clear and actionable

### AC6: Error Handling
- [ ] All error cases display user-friendly messages
- [ ] Errors are logged to console
- [ ] Users can retry after errors
- [ ] Network errors are distinguishable from validation errors

## Edge Cases

### EC1: Exactly Max Balance
**Scenario:** User tries to send entire balance
**Expected:** System calculates max amount = balance - fee, form shows available amount, transaction succeeds

### EC2: Insufficient Balance for Fee
**Scenario:** User has 0.001 SOL, tries to send 0.001 SOL
**Expected:** Simulation fails with "Insufficient funds for transaction fee", suggests sending less

### EC3: Address Copy-Paste with Whitespace
**Scenario:** User copies address with trailing spaces
**Expected:** System trims whitespace automatically, validates correctly

### EC4: Network Switch During Send
**Scenario:** Network changes (mainnet → devnet) while send form is open
**Expected:** Form resets or shows warning, prevents sending to wrong network

### EC5: Very Small Amounts (Dust)
**Scenario:** User sends 0.000001 SOL
**Expected:** Transaction succeeds if valid, no minimum amount restriction

### EC6: Sending to Self
**Scenario:** User enters their own address as recipient
**Expected:** Transaction succeeds (user pays fee to move funds to themselves)

### EC7: RPC Rate Limiting
**Scenario:** RPC endpoint rate-limits simulation request
**Expected:** System retries with exponential backoff, shows "Simulating transaction..." message

### EC8: Transaction Dropped
**Scenario:** Transaction is broadcast but never confirmed (dropped from mempool)
**Expected:** After 30 seconds, show "Transaction may have failed. Check Solana Explorer."

## Non-Functional Requirements

### NFR1: Performance
- Form validation SHALL complete within 100ms
- Transaction simulation SHALL complete within 3 seconds
- Transaction broadcast SHALL timeout after 30 seconds

### NFR2: Security
- Private keys SHALL never be exposed to UI or content scripts
- All signing SHALL occur in background service worker
- Transaction data SHALL be validated before signing
- User SHALL explicitly approve every transaction

### NFR3: Usability
- Form inputs SHALL have clear labels and placeholders
- Error messages SHALL be specific and actionable
- Transaction details SHALL be human-readable (no hex dumps)
- Explorer links SHALL open in new tab

### NFR4: Accessibility
- All form inputs SHALL have proper labels for screen readers
- Keyboard navigation SHALL work for entire flow
- Focus management SHALL be logical (address → amount → review)
- Color-blind safe error indicators (not just red/green)

## Implementation Notes

### Reference: Backpack Wallet Pattern
Following `planning/backpack-research.md` section 4.3:
1. Validate origin (not applicable for internal wallet UI)
2. Parse and validate transaction
3. **Simulate transaction** to check for errors
4. Show approval UI with transaction details
5. Sign transaction if approved
6. Log transaction
7. Broadcast to network

### Technical Components

**New RPC Methods Needed:**
- `simulateTransaction(transaction)` - Simulate before signing
- `sendTransaction(transaction)` - Broadcast signed transaction

**New UI Components:**
- SendForm component (address + amount inputs)
- TransactionApproval component (approval dialog with simulation results)
- TransactionConfirmation component (success/failure feedback)

**State Management:**
- Current send form state (address, amount, errors)
- Pending transaction state (for approval flow)
- Transaction result state (signature, status)

### Dependencies
- `@solana/web3.js` - Transaction creation and serialization
- Existing approval system (`approve-transaction.html`)
- Existing RPC client (`solana-rpc.ts`)
- Existing keyring (`keyring.ts`)

## Future Enhancements (Out of Scope)

- Transaction history/recent recipients
- Address book / saved contacts
- Multiple recipient support (batch transfers)
- SPL token transfers
- Transaction scheduling / recurring payments
- Advanced fee customization
- QR code scanning for recipient address
- ENS/SNS domain name resolution

## Testing Strategy

### Unit Tests
- Input validation functions
- Amount formatting and parsing
- Address validation
- Fee calculation

### Integration Tests
- Complete send flow (mock RPC)
- Simulation error handling
- Approval dialog interactions
- Transaction signing flow

### Manual Testing
1. Send 0.1 SOL to devnet address successfully
2. Try to send more than balance
3. Enter invalid address
4. Reject transaction in approval dialog
5. Close approval dialog (should cancel)
6. Network timeout during simulation
7. Network timeout during broadcast
8. Use "Max" button
9. Send very small amount (0.000001 SOL)
10. Send to self

## Open Questions
- Should we store transaction history locally? (Answer: Future enhancement)
- Should we support custom fees? (Answer: No, use default for simplicity)
- Should we show USD value? (Answer: Future enhancement, requires price API)

---

**Document Status:** Ready for Implementation
**Approver:** Awaiting user confirmation
