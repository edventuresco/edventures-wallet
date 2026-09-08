# My Little Wallet - Sandbox Test Dapp

Test environment for wallet connection, balance queries, and transaction signing.

## What is this?

This is a standalone HTML page that allows you to test the My Little Wallet extension without needing a full dapp setup. It simulates the interactions a real dapp would make with your wallet.

## Setup

1. **Build the extension:**
   ```bash
   npm run build
   ```

2. **Load the extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

3. **Create a wallet:**
   - Click the extension icon in Chrome
   - Follow the onboarding flow to create a wallet
   - Save your seed phrase!

4. **Open the sandbox:**
   - Double-click `sandbox/index.html` to open in browser
   - OR serve it with a local server:
     ```bash
     python3 -m http.server 8000
     # Then visit http://localhost:8000/sandbox/
     ```

## Features

### ✅ Implemented
- **Connect Wallet**: Request connection to the extension
- **Disconnect Wallet**: Disconnect from the extension
- **Get Balance**: Fetch SOL balance for connected address
- **Get Accounts**: Request account information
- **Send Transaction**: Create and sign SOL transfer transactions
- **Event Logging**: Real-time activity log

### 🚧 Coming Soon
- **Connection Approval Dialog**: User approval popup for connection requests
- **Transaction Approval Dialog**: User approval popup for transactions
- **Token Transfers**: SPL token support
- **Message Signing**: Sign arbitrary messages

## Usage

### Connect to Wallet
1. Click "Connect Wallet" button
2. (Future) Approve connection in popup
3. Wallet address will be displayed

### Check Balance
1. Connect wallet first
2. Click "Get Balance" button
3. Balance will be fetched from Solana mainnet

### Send SOL
1. Connect wallet first
2. Enter recipient address
3. Enter amount in SOL
4. Click "Send Transaction"
5. (Future) Approve transaction in popup
6. Transaction will be broadcast to network

## Environment Variables

The extension uses the NOW_NODES_API key if available:
- Mainnet RPC: `https://sol.nownodes.io/{API_KEY}`
- Fallback: `https://api.mainnet-beta.solana.com`

Set `NOW_NODES_API` environment variable before building.

## Troubleshooting

**"window.solana not found"**
- Make sure the extension is loaded and active
- Refresh the page after loading the extension

**"Wallet not connected"**
- Click "Connect Wallet" before trying other operations
- Check browser console for errors

**Balance not loading**
- Verify you have an internet connection
- Check if Solana RPC is accessible
- Open extension service worker console to see RPC logs

## Development Notes

### RPC Methods
The sandbox uses these RPC methods:
- `connect()` - Request wallet connection
- `disconnect()` - Disconnect wallet
- `getBalance(address)` - Get SOL balance
- `signAndSendTransaction(transaction)` - Sign and send transaction

### Connection Flow
```
Dapp → window.solana.connect()
     → Extension Background Service Worker
     → (Future) Approval Dialog
     → Return public key
```

### Transaction Flow
```
Dapp → Build transaction with @solana/web3.js
     → window.solana.signAndSendTransaction(tx)
     → Extension Background Service Worker
     → (Future) Approval Dialog
     → Sign with keyring
     → Broadcast to Solana RPC
     → Return signature
```

## Next Steps

1. **Implement Approval Dialogs**
   - Connection request popup
   - Transaction approval popup
   - Message signing popup

2. **Content Script Integration**
   - Inject `window.solana` provider
   - Bridge dapp ↔ background communication

3. **Wallet Standard Support**
   - Implement full Wallet Standard API
   - Support multiple wallets

4. **Enhanced Features**
   - SPL token support
   - Transaction history
   - Network switching (devnet/testnet/mainnet)
   - Custom RPC endpoints

## Resources

- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [Wallet Standard](https://github.com/wallet-standard/wallet-standard)
- [Backpack Source](https://github.com/coral-xyz/backpack)
