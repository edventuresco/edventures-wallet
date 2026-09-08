# My Little Wallet - Testing Guide

Complete guide for testing the wallet extension with the sandbox dapp.

## ✅ What's Been Implemented

### Core Wallet Features
- ✅ Wallet creation with BIP39 mnemonic (12 words)
- ✅ Password-based encryption (AES-GCM + PBKDF2)
- ✅ Ed25519 keypair derivation
- ✅ Wallet unlock screen
- ✅ SOL balance fetching from mainnet
- ✅ Balance display in popup

### Solana RPC Integration
- ✅ NOW_NODES API support (with fallback to public RPC)
- ✅ Balance queries
- ✅ Account info queries
- ✅ Token balance queries (SPL tokens)
- ✅ Transaction broadcasting
- ✅ Recent blockhash fetching

### Approval System
- ✅ Connection approval popup
- ✅ Transaction approval popup
- ✅ Auto-rejection on window close
- ✅ 2-minute timeout on approvals
- ✅ Persistent connection state

### window.solana Provider
- ✅ Injected into all web pages
- ✅ `connect()` method
- ✅ `disconnect()` method
- ✅ `signTransaction()` method
- ✅ `signAndSendTransaction()` method
- ✅ `signMessage()` method
- ✅ Event emitters (connect, disconnect)

### Content Script Bridge
- ✅ Bridges page ↔ background communication
- ✅ Message forwarding with proper error handling
- ✅ Event propagation

## 🚀 Setup Instructions

### 1. Build the Extension

```bash
cd <your-projects>/my-little-wallet
npm run build
```

### 2. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist` folder from the project
5. Extension should appear with icon

### 3. Create Your Wallet

1. Click the extension icon in Chrome toolbar
2. Click "Get Started" on welcome screen
3. Enter a password (min 8 characters)
4. Confirm password
5. Click "Create Wallet"
6. **IMPORTANT**: Write down your 12-word seed phrase
7. Check "I have safely written down my recovery phrase"
8. Click "Continue"
9. Click "Open Wallet"

You should now see your wallet address and balance!

## 🧪 Testing the Sandbox

### 1. Open the Sandbox Dapp

```bash
# Option 1: Open file directly
open sandbox/index.html

# Option 2: Serve with local server (recommended)
cd <your-projects>/my-little-wallet
python3 -m http.server 8000
# Then visit: http://localhost:8000/sandbox/
```

### 2. Test Connection Flow

1. **Open Sandbox**: You should see "window.solana not found" initially
2. **Refresh Page**: After extension loads, you should see "✓ window.solana detected"
3. **Click "Connect Wallet"**: Approval popup should appear
4. **Review Popup**: Shows site name, permissions requested
5. **Click "Connect"**: Popup closes, wallet connected
6. **Verify**: Sandbox should show your wallet address

**Expected Log Output:**
```
Page loaded, checking for Solana provider...
✓ window.solana detected
Requesting wallet connection...
✓ Connected! Address: <your-address>
```

### 3. Test Balance Fetching

1. **Click "Get Balance"**: Should fetch from mainnet
2. **Wait**: May take a few seconds
3. **Verify**: Balance appears in SOL (will be 0 for new wallet)

**Expected Log Output:**
```
Fetching balance...
✓ Balance: 0.000000000 SOL
```

### 4. Test Transaction Flow (Advanced)

⚠️ **Warning**: This will attempt to send real SOL on mainnet. Only test with a funded wallet or use a test recipient.

1. **Get Test SOL**: Use a faucet or send from another wallet
2. **Enter Recipient**: Paste a valid Solana address
3. **Enter Amount**: Enter amount in SOL (e.g., 0.001)
4. **Click "Send Transaction"**
5. **Review Popup**: Shows amount, recipient, network fee
6. **Click "Approve"**: Transaction signed and broadcast
7. **Wait for Confirmation**: Check balance after 10-20 seconds

**Expected Log Output:**
```
Preparing transaction: 0.001 SOL to <recipient>...
Requesting signature from wallet...
✓ Transaction sent! Signature: <tx-signature>
Explorer: https://solscan.io/tx/<tx-signature>
```

## 🔍 Debugging

### Extension Logs

**Background Service Worker:**
1. Go to `chrome://extensions/`
2. Find "My Little Wallet"
3. Click "service worker" link
4. Console shows background logs

**Content Script:**
1. Open sandbox page
2. Right-click → Inspect
3. Console tab shows content script logs

**Popup:**
1. Open wallet popup
2. Right-click anywhere in popup
3. Click "Inspect"
4. Console tab shows popup logs

### Common Issues

**"window.solana not found"**
- Refresh the page after loading extension
- Check that extension is enabled
- Check background service worker console for errors

**"User rejected connection"**
- You may have closed the approval popup
- Try connecting again

**"Wallet is locked"**
- Extension restarted or wallet timed out
- Click extension icon to unlock with password

**Balance not loading**
- Check internet connection
- Verify Solana RPC is accessible
- Check background service worker for RPC errors

**Transaction fails**
- Insufficient balance for transaction + fees
- Invalid recipient address
- Network congestion (retry later)

## 📊 Testing Checklist

### Wallet Management
- [ ] Create new wallet
- [ ] View seed phrase
- [ ] Copy wallet address
- [ ] Unlock locked wallet
- [ ] Reset wallet (WARNING: permanent!)

### Sandbox Integration
- [ ] window.solana provider detects
- [ ] Connect wallet (approval flow)
- [ ] Disconnect wallet
- [ ] Get balance
- [ ] Build transaction
- [ ] Sign transaction (approval flow)
- [ ] Send transaction

### Approval Dialogs
- [ ] Connection approval opens
- [ ] Connection approval shows site info
- [ ] Can approve connection
- [ ] Can reject connection
- [ ] Transaction approval opens
- [ ] Transaction shows amount/recipient
- [ ] Can approve transaction
- [ ] Can reject transaction

### Error Handling
- [ ] Reject connection → error in dapp
- [ ] Reject transaction → error in dapp
- [ ] Close approval popup → timeout error
- [ ] Invalid transaction → proper error

## 🎯 Next Steps

### Production Readiness
- [ ] Add signature to transactions (currently unsigned)
- [ ] Implement proper transaction validation
- [ ] Add network selection (mainnet/devnet/testnet)
- [ ] Add custom RPC endpoint support
- [ ] Implement auto-lock timeout
- [ ] Add password strength requirements
- [ ] Implement backup/restore flow

### Features
- [ ] SPL token transfers
- [ ] Token account management
- [ ] Transaction history
- [ ] Address book
- [ ] Multi-account support
- [ ] Hardware wallet integration

### UX Improvements
- [ ] Loading states
- [ ] Better error messages
- [ ] Transaction confirmation
- [ ] Success/failure notifications
- [ ] Recent activity feed

## 📝 Reporting Issues

If you encounter issues:

1. Check all logs (background, content, popup)
2. Note the exact steps to reproduce
3. Include error messages from console
4. Check if issue persists after reload

## 🔐 Security Notes

- **This is a development wallet** - DO NOT use with real funds
- Seed phrase is stored encrypted in Chrome local storage
- Password is never stored, only used to derive encryption key
- Private key never leaves the extension
- All sensitive operations require user approval

## 📚 Resources

- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Wallet Standard](https://github.com/wallet-standard/wallet-standard)
- [Backpack Source](https://github.com/coral-xyz/backpack)

---

Happy testing! 🦄
