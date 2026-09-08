# SwapKit Technical Research Document

**Research Date:** 2026-01-24
**Version Analyzed:** SwapKit v4.x (from examples/SwapKit)
**Focus:** Integration with Solana browser extension wallets and DEX functionality

---

## Executive Summary

SwapKit is a comprehensive multi-chain integration SDK developed by the THORChain/SwapKit team. It provides unified APIs for blockchain interactions, wallet connections, and cross-chain swaps. The framework supports 15+ blockchains including Solana, with modular architecture enabling easy integration with browser extension wallets.

**Key Findings:**
- Monorepo architecture with 17 packages
- Native Solana support via toolboxes and plugins
- Browser extension wallet integration (Phantom included)
- Jupiter aggregator integration for Solana swaps
- TypeScript/Bun-based development environment

---

## 1. Core Architecture

### 1.1 Package Structure

SwapKit uses a monorepo with workspace-based packages:

```
packages/
├── core/          # Core SwapKit engine
├── helpers/       # Utilities, types, constants
├── toolboxes/     # Chain-specific implementations
├── plugins/       # DEX/protocol integrations
├── wallets/       # Wallet connectors
├── sdk/           # Complete SDK bundle
├── types/         # TypeScript definitions
├── tokens/        # Token lists and metadata
├── contracts/     # Smart contract ABIs
├── browser/       # Browser-specific utilities
├── server/        # Server-side functionality
└── ui/            # UI components
```

### 1.2 Core Design Patterns

**Plugin Architecture:**
```typescript
// From packages/core/src/index.ts
export function SwapKit<Plugins, Wallets>({
  config,
  plugins,
  wallets
}: {
  config?: SKConfigState;
  plugins?: Plugins;
  wallets?: Wallets;
}) {
  // Returns unified interface for all chains
  return {
    // Wallet methods
    getWallet, getAllWallets, getAddress,
    connectWallet, disconnectChain, disconnectAll,

    // Balance methods
    getBalance, getWalletWithBalance,

    // Transaction methods
    transfer, swap, approve,
    estimateTransactionFee,

    // Signing methods
    signMessage, verifyMessage,

    // Plugin methods (merged dynamically)
    ...availablePlugins
  };
}
```

**Key Principles:**
- Chain-agnostic API surface
- Lazy-loaded chain toolboxes
- Plugin-based extensibility
- Type-safe wallet and plugin composition

---

## 2. Solana Integration

### 2.1 Solana Toolbox

**Location:** `packages/toolboxes/src/solana/toolbox.ts`

**Dependencies:**
```json
{
  "@solana/web3.js": "~1.98.0",
  "@solana/spl-token": "~0.4.14",
  "@solana/spl-memo": "~0.2.5"
}
```

**Core Capabilities:**

```typescript
// Main toolbox factory
export async function getSolanaToolbox(params?: {
  signer?: SolanaSigner
} | {
  phrase?: string;
  index?: number;
  derivationPath?: DerivationPathArray
}) {
  return {
    // Address utilities
    getAddress,
    getAddressFromPubKey,
    getPubkeyFromAddress,
    getAddressValidator,

    // Key management
    createKeysForPath,

    // Transaction operations
    createTransaction,
    createTransactionFromInstructions,
    signTransaction,
    broadcastTransaction,
    transfer,

    // Fee estimation
    estimateTransactionFee,

    // Balance queries
    getBalance,

    // RPC connection
    getConnection
  };
}
```

**Balance Fetching:**
```typescript
async function getSolanaBalance(address: string) {
  const connection = await getConnection();
  const publicKey = new PublicKey(address);

  // Native SOL balance
  const solBalance = await connection.getBalance(publicKey);
  const balances = [AssetValue.from({
    chain: Chain.Solana,
    value: solBalance
  })];

  // SPL token balances
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    publicKey,
    { programId: TOKEN_PROGRAM_ID }
  );

  for (const { account } of tokenAccounts.value) {
    const tokenInfo = account.data.parsed.info;
    const mintAddress = tokenInfo.mint;
    const amount = tokenInfo.tokenAmount.amount;

    // Fetch metadata from Jupiter API
    const metadata = await fetchTokenMetaData(mintAddress);

    balances.push(AssetValue.from({
      asset: `${Chain.Solana}.${ticker}-${mintAddress}`,
      value: amount,
      fromBaseDecimal: decimals
    }));
  }

  return balances;
}
```

**Transaction Creation:**
```typescript
// Native SOL transfers
async function createTransaction({
  recipient,
  assetValue,
  sender,
  memo,
  isProgramDerivedAddress
}: SolanaCreateTransactionParams) {
  const connection = await getConnection();
  const fromPubkey = new PublicKey(sender);

  let transaction: Transaction;

  if (assetValue.isGasAsset) {
    // Native SOL transfer
    transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey: new PublicKey(recipient),
        lamports: assetValue.getBaseValue("number")
      })
    );
  } else {
    // SPL token transfer
    transaction = await createSolanaTokenTransaction({
      tokenAddress: assetValue.address,
      recipient,
      from: fromPubkey,
      connection,
      amount: assetValue.getBaseValue("number"),
      decimals: assetValue.decimal,
      isProgramDerivedAddress
    });
  }

  // Add memo if provided
  if (memo) {
    transaction.add(createMemoInstruction(memo));
  }

  // Set recent blockhash and fee payer
  const blockHash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockHash.blockhash;
  transaction.feePayer = fromPubkey;

  return transaction;
}
```

**SPL Token Handling:**
```typescript
async function createSolanaTokenTransaction({
  tokenAddress,
  recipient,
  from,
  connection,
  amount,
  decimals,
  isProgramDerivedAddress
}: {
  tokenAddress: string;
  recipient: string;
  from: PublicKey;
  connection: Connection;
  amount: number;
  decimals: number;
  isProgramDerivedAddress?: boolean;
}) {
  const transaction = new Transaction();
  const tokenPublicKey = new PublicKey(tokenAddress);

  // Get sender's associated token account
  const fromSPLAddress = await getAssociatedTokenAddress(
    tokenPublicKey,
    from
  );

  // Get recipient's associated token account
  const recipientPublicKey = new PublicKey(recipient);
  const recipientSPLAddress = await getAssociatedTokenAddress(
    tokenPublicKey,
    recipientPublicKey,
    isProgramDerivedAddress
  );

  // Check if recipient's token account exists
  let recipientAccountExists = false;
  try {
    await getAccount(connection, recipientSPLAddress);
    recipientAccountExists = true;
  } catch {
    // Account doesn't exist, need to create it
  }

  // Create associated token account if needed
  if (!recipientAccountExists) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        from,
        recipientSPLAddress,
        recipientPublicKey,
        tokenPublicKey
      )
    );
  }

  // Add transfer instruction
  transaction.add(
    createTransferCheckedInstruction(
      fromSPLAddress,
      tokenPublicKey,
      recipientSPLAddress,
      from,
      amount,
      decimals
    )
  );

  return transaction;
}
```

### 2.2 Token Metadata Integration

**Jupiter API Integration:**
```typescript
export async function fetchTokenMetaData(
  mintAddress: string
): Promise<TokenMetadata | null> {
  // First check local token list
  const assetValue = AssetValue.from({
    address: mintAddress,
    chain: Chain.Solana
  });

  if (assetValue.symbol !== "UNKNOWN") {
    return {
      decimals: assetValue.decimal || 0,
      id: mintAddress,
      logoURI: assetValue.getIconUrl(),
      name: assetValue.symbol,
      symbol: assetValue.ticker
    };
  }

  // Fallback to Jupiter API
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${
    encodeURIComponent(mintAddress)
  }`;

  const res = await fetch(url);
  const tokens = await res.json() as TokenMetadata[];

  return tokens.find(t => t.id === mintAddress) || null;
}
```

---

## 3. Wallet Integration

### 3.1 Browser Extension Wallet Pattern

**Generic Wallet Creation:**
```typescript
// From packages/wallet-core
export const createWallet = ({
  connect,
  name,
  supportedChains,
  walletType
}) => ({
  connectWallet: ({ addChain }) => connect({
    addChain,
    supportedChains,
    walletType
  }),
  supportedChains,
  walletType
});
```

### 3.2 Phantom Wallet Integration

**Location:** `packages/wallet-extensions/src/phantom/index.ts`

**Supported Chains:**
- Solana
- Ethereum
- Bitcoin
- Monad

**Implementation:**
```typescript
export const phantomWallet = createWallet({
  connect: ({ addChain, supportedChains, walletType }) =>
    async function connectPhantom(chains: Chain[]) {
      const filteredChains = filterSupportedChains({
        chains,
        supportedChains,
        walletType
      });

      await Promise.all(
        filteredChains.map(async (chain) => {
          const { address, ...methods } = await getWalletMethods(chain);
          addChain({ ...methods, address, chain, walletType });
        })
      );

      return true;
    },
  name: "connectPhantom",
  supportedChains: [Chain.Bitcoin, Chain.Ethereum, Chain.Monad, Chain.Solana],
  walletType: WalletOption.PHANTOM
});
```

**Solana-Specific Connection:**
```typescript
async function getWalletMethods(chain: PhantomSupportedChain) {
  const phantom: any = window?.phantom;

  switch (chain) {
    case Chain.Solana: {
      const { getSolanaToolbox } = await import("@swapkit/toolboxes/solana");
      const provider = phantom?.solana;

      if (!provider?.isPhantom) {
        throw new SwapKitError("wallet_phantom_not_found");
      }

      // Connect to Phantom
      const providerConnection = await provider.connect();
      const address: string = providerConnection.publicKey.toString();

      // Get Solana toolbox with Phantom as signer
      const toolbox = await getSolanaToolbox({ signer: provider });

      // Override transfer method for Phantom-specific signing
      const transfer = async ({
        recipient,
        assetValue,
        isProgramDerivedAddress
      }: GenericTransferParams & {
        assetValue: AssetValue;
        isProgramDerivedAddress?: boolean;
      }) => {
        const { PublicKey } = await import("@solana/web3.js");
        const validateAddress = await toolbox.getAddressValidator();

        if (!(isProgramDerivedAddress || validateAddress(recipient))) {
          throw new SwapKitError("core_transaction_invalid_recipient_address");
        }

        const fromPubkey = new PublicKey(address);
        const connection = await toolbox.getConnection();

        // Create transaction using toolbox
        const transaction = await toolbox.createTransaction({
          assetValue,
          isProgramDerivedAddress,
          recipient,
          sender: address
        });

        if (!transaction) {
          throw new SwapKitError("core_transaction_invalid_sender_address");
        }

        // Set blockhash and fee payer
        const blockHash = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockHash.blockhash;
        transaction.feePayer = fromPubkey;

        // Sign with Phantom provider
        const signedTransaction = await provider.signTransaction(transaction);

        // Broadcast
        const txid = await connection.sendRawTransaction(
          signedTransaction.serialize()
        );

        return txid;
      };

      return { ...toolbox, address, transfer };
    }
    // ... other chains
  }
}
```

**Key Integration Points:**
1. **Provider Detection:** Checks for `window.phantom.solana.isPhantom`
2. **Connection Flow:** Uses `provider.connect()` for user approval
3. **Signing:** Uses `provider.signTransaction()` for Phantom's signature UI
4. **Broadcasting:** Uses toolbox's connection for transaction submission

### 3.3 Wallet Interface

**FullWallet Type:**
```typescript
interface FullWallet {
  [Chain.Solana]: {
    address: string;
    balance: AssetValue[];
    chain: Chain.Solana;
    walletType: WalletOption;

    // Core methods
    transfer: (params: GenericTransferParams) => Promise<string>;
    getBalance: (address: string, scamFilter?: boolean) => Promise<AssetValue[]>;

    // Transaction methods
    createTransaction: (params: SolanaCreateTransactionParams) => Promise<Transaction>;
    signTransaction: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
    broadcastTransaction: (tx: Transaction | VersionedTransaction) => Promise<string>;

    // Fee estimation
    estimateTransactionFee: (params: GenericCreateTransactionParams) => Promise<AssetValue>;

    // Utilities
    getAddress: () => string;
    getAddressValidator: () => (address: string) => boolean;
    getConnection: () => Promise<Connection>;

    // Optional
    disconnect?: () => void;
  };
  // ... other chains
}
```

---

## 4. Swap/DEX Integration

### 4.1 Plugin Architecture

**Plugin Creation Pattern:**
```typescript
// From packages/plugins/src/utils.ts
export const createPlugin = ({
  methods,
  name,
  properties
}: {
  methods: (deps: { getWallet: GetWallet }) => PluginMethods;
  name: string;
  properties?: PluginProperties;
}) => ({
  [name]: (deps: { getWallet: GetWallet }) => ({
    ...methods(deps),
    ...properties
  })
});
```

### 4.2 Solana Swap Plugin

**Location:** `packages/plugins/src/solana/plugin.ts`

**Jupiter Integration:**
```typescript
export const SolanaPlugin = createPlugin({
  methods: ({ getWallet }) => ({
    swap: async function solanaSwap({
      route
    }: SwapParams<"solana", QuoteResponseRoute>) {
      const { VersionedTransaction } = await import("@solana/web3.js");
      const { tx, sellAsset } = route;

      const assetValue = await AssetValue.from({ asset: sellAsset });
      const chain = assetValue.chain;

      if (!(chain === Chain.Solana && tx)) {
        throw new SwapKitError("core_swap_invalid_params");
      }

      // Get connected Solana wallet
      const wallet = getWallet(chain);

      // Deserialize transaction from Jupiter API
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(tx as string, "base64")
      );

      // Sign with wallet
      const signedTransaction = await wallet.signTransaction(transaction);

      // Broadcast
      return wallet.broadcastTransaction(signedTransaction);
    }
  }),
  name: "solana",
  properties: {
    supportedSwapkitProviders: [ProviderName.JUPITER] as const
  }
});
```

**Swap Flow:**
1. **Get Quote:** Client calls Jupiter API for quote
2. **Receive Transaction:** Jupiter returns serialized VersionedTransaction
3. **Sign:** User signs via connected wallet (e.g., Phantom)
4. **Execute:** Broadcast signed transaction to Solana network

### 4.3 Supported DEX Providers

**Provider Enum:**
```typescript
enum ProviderName {
  // Solana
  JUPITER = "JUPITER",

  // EVM
  UNISWAP = "UNISWAP",
  ONEINCH = "ONEINCH",

  // Cross-chain
  CHAINFLIP = "CHAINFLIP",
  CHAINFLIP_STREAMING = "CHAINFLIP_STREAMING",
  THORCHAIN = "THORCHAIN",
  MAYACHAIN = "MAYACHAIN",

  // Others
  GARDEN = "GARDEN",
  // ... more
}
```

**Plugin Registry:**
```typescript
// From packages/sdk/src/index.ts
export const defaultPlugins = {
  ...ChainflipPlugin,    // Cross-chain swaps
  ...EVMPlugin,          // EVM DEXes
  ...MayachainPlugin,    // Maya protocol
  ...ThorchainPlugin,    // THORChain
  ...RadixPlugin,        // Radix DEX
  ...SolanaPlugin,       // Jupiter
  ...NearPlugin,         // NEAR swaps
  ...GardenPlugin        // Bitcoin DeFi
};
```

---

## 5. API Design

### 5.1 SwapKit Core API

**Initialization:**
```typescript
import { createSwapKit } from "@swapkit/sdk";

const swapKit = createSwapKit({
  config: {
    stagenet: false,  // Use mainnet
    covalentApiKey: "YOUR_KEY",
    ethplorerApiKey: "YOUR_KEY",
    walletConnectProjectId: "YOUR_PROJECT_ID"
  },
  plugins: {
    // Use default plugins or provide custom
  },
  wallets: {
    // Use default wallets or provide custom
  }
});
```

**Wallet Connection:**
```typescript
// Connect Phantom wallet to Solana
await swapKit.connectPhantom([Chain.Solana]);

// Get wallet instance
const solanaWallet = swapKit.getWallet(Chain.Solana);
console.log(solanaWallet.address);

// Get balance
const balance = await swapKit.getBalance(Chain.Solana, true); // refresh
console.log(balance); // AssetValue[]

// Get specific wallet data
const allWallets = swapKit.getAllWallets();
```

**Transfers:**
```typescript
// Transfer SOL
await swapKit.transfer({
  assetValue: AssetValue.from({
    chain: Chain.Solana,
    value: "0.1"
  }),
  recipient: "RECIPIENT_ADDRESS"
});

// Transfer SPL token
await swapKit.transfer({
  assetValue: AssetValue.from({
    asset: "SOL.USDC-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    value: "10"
  }),
  recipient: "RECIPIENT_ADDRESS",
  isProgramDerivedAddress: false // Optional for PDA
});
```

**Swaps:**
```typescript
// Get quote from Jupiter (via SwapKit API/backend)
const route = await getQuoteRoute({
  sellAsset: "SOL.SOL",
  buyAsset: "SOL.USDC-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  sellAmount: "1"
});

// Execute swap
const txHash = await swapKit.swap({
  route,
  pluginName: ProviderName.JUPITER
});
```

**Fee Estimation:**
```typescript
const fee = await swapKit.estimateTransactionFee({
  type: "transfer",
  feeOptionKey: "average",
  params: {
    assetValue: AssetValue.from({ chain: Chain.Solana, value: "0.1" }),
    recipient: "RECIPIENT_ADDRESS"
  }
});

console.log(fee.toString()); // AssetValue in SOL
```

### 5.2 Type System

**AssetValue:**
```typescript
class AssetValue {
  chain: Chain;
  symbol: string;
  ticker: string;
  decimal: number;
  address?: string;

  static from(params: {
    asset?: string;          // e.g., "SOL.USDC-EPjF..."
    chain?: Chain;
    value?: string | number | bigint;
    fromBaseDecimal?: number;
  }): AssetValue;

  // Value getters
  getBaseValue(type: "string" | "number" | "bigint"): any;
  getValue(type: "string" | "number" | "bigint"): any;

  // Formatting
  toString(): string;
  toSignificant(decimals: number): string;

  // Checks
  get isGasAsset(): boolean;
  get isSynthetic(): boolean;

  // Comparisons
  add(other: AssetValue): AssetValue;
  sub(other: AssetValue): AssetValue;
  mul(factor: number): AssetValue;
  div(factor: number): AssetValue;

  // Utilities
  getIconUrl(): string;
}
```

**Chain Enum:**
```typescript
enum Chain {
  Arbitrum = "ARB",
  Avalanche = "AVAX",
  BinanceSmartChain = "BSC",
  Bitcoin = "BTC",
  BitcoinCash = "BCH",
  Cardano = "ADA",
  Cosmos = "GAIA",
  Dogecoin = "DOGE",
  Ethereum = "ETH",
  Litecoin = "LTC",
  Maya = "MAYA",
  Near = "NEAR",
  Optimism = "OP",
  Polkadot = "DOT",
  Polygon = "MATIC",
  Radix = "XRD",
  Ripple = "XRP",
  Solana = "SOL",
  Sui = "SUI",
  THORChain = "THOR",
  Ton = "TON",
  Tron = "TRN",
  // ... more
}
```

---

## 6. Integration with Solana Browser Extension Wallet

### 6.1 Architecture Recommendations

**For my-little-wallet Integration:**

```typescript
// 1. Use SwapKit's wallet-core pattern
import { createWallet } from "@swapkit/wallet-core";
import { Chain, WalletOption } from "@swapkit/helpers";

export const myLittleWallet = createWallet({
  connect: ({ addChain, supportedChains, walletType }) =>
    async function connectMyLittleWallet(chains: Chain[]) {
      // Detect extension
      const provider = window?.myLittleWallet?.solana;

      if (!provider) {
        throw new Error("My Little Wallet not found");
      }

      // Connect
      const response = await provider.connect();
      const address = response.publicKey.toString();

      // Get Solana toolbox
      const { getSolanaToolbox } = await import("@swapkit/toolboxes/solana");
      const toolbox = await getSolanaToolbox({ signer: provider });

      // Override transfer method for wallet-specific signing
      const transfer = async ({ recipient, assetValue, isProgramDerivedAddress }) => {
        const transaction = await toolbox.createTransaction({
          assetValue,
          recipient,
          sender: address,
          isProgramDerivedAddress
        });

        // Use wallet's signing method
        const signedTx = await provider.signTransaction(transaction);

        return toolbox.broadcastTransaction(signedTx);
      };

      // Add chain to SwapKit
      addChain({
        ...toolbox,
        address,
        transfer,
        chain: Chain.Solana,
        walletType
      });

      return true;
    },
  name: "connectMyLittleWallet",
  supportedChains: [Chain.Solana],
  walletType: WalletOption.MY_LITTLE_WALLET  // Add to enum
});
```

### 6.2 Extension Interface Requirements

**Minimum Provider Interface:**
```typescript
interface MyLittleWalletProvider {
  // Connection
  connect(): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;

  // Properties
  isConnected: boolean;
  publicKey: PublicKey | null;

  // Signing
  signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T>;

  signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]>;

  signMessage(
    message: Uint8Array,
    display?: "utf8" | "hex"
  ): Promise<{ signature: Uint8Array }>;

  // Events
  on(event: "connect", handler: (publicKey: PublicKey) => void): void;
  on(event: "disconnect", handler: () => void): void;
  on(event: "accountChanged", handler: (publicKey: PublicKey | null) => void): void;

  // Standard properties
  isMyLittleWallet?: boolean;
}

// Window augmentation
declare global {
  interface Window {
    myLittleWallet?: {
      solana?: MyLittleWalletProvider;
    };
  }
}
```

### 6.3 Integration Steps

**Step 1: Create Wallet Connector**
- Implement `createWallet` pattern
- Handle provider detection
- Integrate with SwapKit toolbox

**Step 2: Register with SwapKit**
```typescript
import { createSwapKit } from "@swapkit/sdk";
import { myLittleWallet } from "./my-little-wallet-connector";

const swapKit = createSwapKit({
  wallets: {
    ...myLittleWallet
  }
});
```

**Step 3: Use SwapKit API**
```typescript
// Connect wallet
await swapKit.connectMyLittleWallet([Chain.Solana]);

// Get balance
const balance = await swapKit.getBalance(Chain.Solana, true);

// Transfer
await swapKit.transfer({
  assetValue: AssetValue.from({ chain: Chain.Solana, value: "0.1" }),
  recipient: "TARGET_ADDRESS"
});

// Swap via Jupiter
const txHash = await swapKit.swap({ route, pluginName: "JUPITER" });
```

---

## 7. Dependencies and Requirements

### 7.1 Core Dependencies

**Solana Packages:**
```json
{
  "@solana/web3.js": "~1.98.0",
  "@solana/spl-token": "~0.4.14",
  "@solana/spl-memo": "~0.2.5"
}
```

**Key Management:**
```json
{
  "@scure/bip39": "~2.0.1",
  "@scure/bip32": "~2.0.1",
  "micro-key-producer": "~0.8.2"
}
```

**Utilities:**
```json
{
  "ethers": "^6.14.0",      // For BN and utils
  "ts-pattern": "^5.9.0",   // Pattern matching
  "zod": "3.25.74",         // Schema validation
  "zustand": "5.0.8"        // State management
}
```

### 7.2 Build System

**Package Manager:** Bun ^1.3.1

**Build Tools:**
```json
{
  "typescript": "5.9.3",
  "@biomejs/biome": "2.3.4",  // Linting/formatting
  "@changesets/cli": "2.29.7"  // Version management
}
```

**Workspace Configuration:**
```json
{
  "workspaces": [
    "packages/*",
    "playgrounds/*",
    "tools/*",
    "docs"
  ]
}
```

### 7.3 Runtime Requirements

**Browser:**
- ES2020+ support
- WebAssembly support (for crypto operations)
- LocalStorage/SessionStorage
- Fetch API

**Node.js (for backend/build):**
- Node 18+
- Bun 1.3+

---

## 8. Code Examples

### 8.1 Complete Integration Example

```typescript
import { createSwapKit, Chain, AssetValue, ProviderName } from "@swapkit/sdk";

// 1. Initialize SwapKit
const swapKit = createSwapKit({
  config: {
    stagenet: false
  }
});

// 2. Connect Phantom wallet
async function connectWallet() {
  try {
    await swapKit.connectPhantom([Chain.Solana]);

    const wallet = swapKit.getWallet(Chain.Solana);
    console.log("Connected:", wallet.address);

    return wallet;
  } catch (error) {
    console.error("Connection failed:", error);
    throw error;
  }
}

// 3. Get balances
async function getBalances() {
  const balances = await swapKit.getBalance(Chain.Solana, true);

  balances.forEach(balance => {
    console.log(`${balance.ticker}: ${balance.toSignificant(6)}`);
  });

  return balances;
}

// 4. Transfer SOL
async function transferSOL(recipient: string, amount: string) {
  const assetValue = AssetValue.from({
    chain: Chain.Solana,
    value: amount
  });

  const txHash = await swapKit.transfer({
    assetValue,
    recipient
  });

  console.log("Transfer successful:", txHash);
  return txHash;
}

// 5. Transfer SPL Token
async function transferSPLToken(
  mintAddress: string,
  recipient: string,
  amount: string
) {
  const assetValue = AssetValue.from({
    asset: `SOL.TOKEN-${mintAddress}`,
    value: amount
  });

  const txHash = await swapKit.transfer({
    assetValue,
    recipient,
    isProgramDerivedAddress: false
  });

  return txHash;
}

// 6. Estimate fees
async function estimateFee(recipient: string, amount: string) {
  const fee = await swapKit.estimateTransactionFee({
    type: "transfer",
    feeOptionKey: "average",
    params: {
      assetValue: AssetValue.from({
        chain: Chain.Solana,
        value: amount
      }),
      recipient
    }
  });

  console.log("Estimated fee:", fee.toString());
  return fee;
}

// 7. Execute swap via Jupiter
async function swapTokens(
  fromAsset: string,
  toAsset: string,
  amount: string
) {
  // Get quote from backend/Jupiter API
  const route = await fetch("https://api.example.com/quote", {
    method: "POST",
    body: JSON.stringify({
      sellAsset: fromAsset,
      buyAsset: toAsset,
      sellAmount: amount
    })
  }).then(r => r.json());

  // Execute swap
  const txHash = await swapKit.swap({
    route,
    pluginName: ProviderName.JUPITER,
    assetValue: AssetValue.from({ asset: fromAsset, value: amount })
  });

  console.log("Swap successful:", txHash);
  return txHash;
}

// 8. Sign message
async function signMessage(message: string) {
  const signature = await swapKit.signMessage({
    chain: Chain.Solana,
    message
  });

  return signature;
}

// Usage
async function main() {
  await connectWallet();
  await getBalances();

  const txHash = await transferSOL(
    "RECIPIENT_ADDRESS",
    "0.1"
  );

  console.log("Transaction:", txHash);
}

main().catch(console.error);
```

### 8.2 Custom Wallet Integration Example

```typescript
import { createWallet, getWalletSupportedChains } from "@swapkit/wallet-core";
import { Chain, WalletOption, SwapKitError } from "@swapkit/helpers";
import type { SolanaProvider } from "@swapkit/toolboxes/solana";

// Define wallet option
const MY_WALLET = "MY_LITTLE_WALLET" as const;

// Create wallet connector
export const myLittleWallet = createWallet({
  connect: ({ addChain, supportedChains, walletType }) =>
    async function connectMyLittleWallet(chains: Chain[]) {
      const filteredChains = chains.filter(c =>
        supportedChains.includes(c)
      );

      for (const chain of filteredChains) {
        if (chain === Chain.Solana) {
          const methods = await connectSolana();
          addChain({ ...methods, chain, walletType });
        }
      }

      return true;
    },
  name: "connectMyLittleWallet",
  supportedChains: [Chain.Solana],
  walletType: MY_WALLET
});

async function connectSolana() {
  // Get provider from window
  const provider = window?.myLittleWallet?.solana as SolanaProvider;

  if (!provider) {
    throw new SwapKitError("wallet_not_found");
  }

  // Connect
  const { publicKey } = await provider.connect();
  const address = publicKey.toString();

  // Get toolbox
  const { getSolanaToolbox } = await import("@swapkit/toolboxes/solana");
  const toolbox = await getSolanaToolbox({ signer: provider });

  // Custom transfer implementation
  const transfer = async ({
    recipient,
    assetValue,
    isProgramDerivedAddress
  }) => {
    const { PublicKey } = await import("@solana/web3.js");

    // Validate recipient
    const validateAddress = await toolbox.getAddressValidator();
    if (!(isProgramDerivedAddress || validateAddress(recipient))) {
      throw new SwapKitError("core_transaction_invalid_recipient_address");
    }

    // Create transaction
    const connection = await toolbox.getConnection();
    const transaction = await toolbox.createTransaction({
      assetValue,
      isProgramDerivedAddress,
      recipient,
      sender: address
    });

    // Set blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(address);

    // Sign with provider
    const signed = await provider.signTransaction(transaction);

    // Broadcast
    const txid = await connection.sendRawTransaction(signed.serialize());

    return txid;
  };

  // Custom sign transaction
  const signTransaction = async (transaction) => {
    const { VersionedTransaction } = await import("@solana/web3.js");
    const connection = await toolbox.getConnection();

    if (!(transaction instanceof VersionedTransaction)) {
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = provider.publicKey;
    }

    return provider.signTransaction(transaction);
  };

  // Custom disconnect
  const disconnect = async () => {
    await provider.disconnect();
  };

  return {
    ...toolbox,
    address,
    transfer,
    signTransaction,
    disconnect
  };
}

// Export supported chains
export const MY_LITTLE_WALLET_SUPPORTED_CHAINS =
  getWalletSupportedChains(myLittleWallet);
```

---

## 9. Key Findings for my-little-wallet

### 9.1 Strengths

**Architecture:**
- Clean separation of concerns (toolboxes, plugins, wallets)
- Type-safe throughout
- Modular and extensible
- Well-tested patterns

**Solana Support:**
- Comprehensive Solana integration
- SPL token support
- Associated token account creation
- Jupiter DEX integration
- Fee estimation
- Metadata fetching

**Developer Experience:**
- Unified API across chains
- Good TypeScript types
- Clear documentation structure
- Active development (v4.x)

### 9.2 Integration Opportunities

**Direct Usage:**
- Use SwapKit toolboxes directly for Solana operations
- Adopt wallet connector pattern for browser extension
- Leverage Jupiter integration for swaps

**Customization:**
- Extend with custom wallet connector
- Add wallet-specific features
- Integrate with my-little-wallet UI

**Reusable Components:**
- AssetValue class for amount handling
- Transaction builders
- Fee estimation logic
- Balance fetching with metadata

### 9.3 Recommended Approach

**Phase 1: Core Integration**
1. Install `@swapkit/toolboxes` and `@swapkit/helpers`
2. Use Solana toolbox for wallet operations
3. Implement basic send/receive

**Phase 2: Wallet Connector**
1. Create `myLittleWallet` connector using wallet-core pattern
2. Register with SwapKit SDK
3. Enable full SwapKit API access

**Phase 3: DEX Integration**
1. Integrate Jupiter via SwapKit plugin
2. Add quote fetching
3. Implement swap UI

**Phase 4: Advanced Features**
1. Multi-chain support (if needed)
2. Custom plugins
3. Advanced transaction types

### 9.4 Code Reuse Strategy

**High-Value Components to Adopt:**

1. **Solana Toolbox** (`packages/toolboxes/src/solana/`)
   - Transaction creation
   - SPL token handling
   - Fee estimation
   - Address validation

2. **AssetValue Class** (`packages/helpers/src/modules/assetValue/`)
   - Amount handling
   - Decimal conversion
   - Formatting

3. **Token Metadata** (`packages/toolboxes/src/solana/toolbox.ts`)
   - Jupiter API integration
   - Local token lists
   - Icon URLs

4. **Wallet Pattern** (`packages/wallet-core/`)
   - Connection flow
   - Error handling
   - Type safety

**Low-Hanging Fruit:**
```typescript
// Can directly copy/adapt:
- fetchTokenMetaData() function
- getSolanaBalance() function
- createSolanaTokenTransaction() function
- AssetValue utility class
- Type definitions
```

---

## 10. Additional Resources

### 10.1 Repository Structure

**Main Repository:** https://github.com/swapkit/SwapKit
**Documentation:** https://swapkit.github.io/SwapKit
**Package Manager:** Bun (https://bun.sh)

### 10.2 Key Files to Review

**Core:**
- `packages/core/src/index.ts` - Main SwapKit engine
- `packages/sdk/src/index.ts` - Complete SDK bundle

**Solana:**
- `packages/toolboxes/src/solana/toolbox.ts` - Solana implementation
- `packages/plugins/src/solana/plugin.ts` - Jupiter integration
- `packages/wallet-extensions/src/phantom/index.ts` - Phantom wallet

**Utilities:**
- `packages/helpers/src/modules/assetValue/` - Amount handling
- `packages/helpers/src/chains.ts` - Chain configurations
- `packages/types/` - TypeScript definitions

### 10.3 Testing

**Example Playground:**
- `playgrounds/vite/` - React example app
- `playgrounds/vite/src/Wallet.tsx` - Wallet component
- `playgrounds/vite/src/Swap/` - Swap components

---

## 11. Conclusion

SwapKit provides a production-ready framework for Solana wallet and DEX integration. The architecture is well-designed, type-safe, and extensible. For my-little-wallet:

**Recommended Path:**
1. Adopt Solana toolbox patterns for transaction handling
2. Create wallet connector following wallet-core pattern
3. Integrate Jupiter for swaps using existing plugin
4. Reuse AssetValue and utility classes

**Key Benefits:**
- Battle-tested code
- Comprehensive Solana support
- Easy Jupiter integration
- Clean architecture patterns
- Active maintenance

**Customization Areas:**
- Wallet-specific UI/UX
- Custom transaction types
- Extension-specific features
- Branding and identity

The codebase is well-structured for selective adoption - you can use components piecemeal or integrate the full SDK depending on project needs.
