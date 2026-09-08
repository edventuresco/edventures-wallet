# Installation Guide

## Quick Start (Development)

### 1. Install Dependencies

```bash
npm install
# or
bun install
```

### 2. Build the Extension

```bash
npm run build
# or
bun run build
```

This creates a `dist/` folder with the compiled extension.

### 3. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/` folder from this project

### 4. Test the Extension

1. Click the extension icon in Chrome toolbar
2. Your wallet address will be displayed
3. Visit a Solana dApp to test connectivity:
   - [wallet-adapter example](https://solana-labs.github.io/wallet-adapter/example/)
   - [pump.fun](https://pump.fun) (if you're feeling adventurous)

## Development Workflow

### Watch Mode

```bash
npm run dev
```

This watches for file changes and rebuilds automatically. After changes, click the refresh icon on the extension in `chrome://extensions/`.

### Type Checking

```bash
npm run type-check
```

## Testing the Provider

### Test window.solana

Open browser console on any page and run:

```javascript
// Check if provider is available
console.log(window.solana);

// Connect wallet
const result = await window.solana.connect();
console.log("Connected:", result.publicKey.toBase58());

// Sign a message
const message = new TextEncoder().encode("Hello Solana!");
const { signature } = await window.solana.signMessage(message);
console.log("Signature:", signature);
```

### Test Wallet Standard

```javascript
// Check Wallet Standard registry
console.log(window.navigator.wallets);

// Get registered wallets
const wallets = window.navigator.wallets.get();
console.log("Available wallets:", wallets);
```

## Troubleshooting

### Extension doesn't load

- Check that you built with `npm run build` first
- Check browser console for errors
- Ensure manifest.json is in dist/ folder

### window.solana is undefined

- Check that content script is injecting properly
- Look for "Provider injected successfully" in console
- Verify web_accessible_resources in manifest

### Connection fails

- Check background service worker console
- Look for errors in extension service worker (chrome://extensions/ → background page)
- Verify origin is being tracked in state

### Build errors

- Run `npm install` to ensure dependencies are installed
- Check Node.js version (18+ recommended)
- Clear `node_modules` and reinstall if issues persist

## Security Features

✅ **Production-Ready Security Implementation**

- ✅ Private keys encrypted with AES-GCM (256-bit)
- ✅ PBKDF2 key derivation (100,000 iterations)
- ✅ Password protection with unlock/lock state management
- ✅ BIP39 mnemonic recovery (12-word seed phrase)
- ✅ HD wallet derivation (BIP44 standard)
- ⚠️ Auto-approves all connections (development mode - update for production)

## Next Steps

After installation:

1. Test with wallet-adapter example dApp
2. Try connecting to various Solana dApps
3. Check console logs to see provider communication
4. Experiment with signing transactions and messages

## Build Output Structure

```
dist/
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── content-bridge.js      # Content script
├── injected-provider.js   # Page provider
├── popup.html            # Popup UI
├── popup.tsx             # Popup script
└── icons/                # Extension icons (placeholder)
```
