/**
 * Popup UI with Onboarding Flow
 *
 * State machine managing:
 * - Wallet initialization check
 * - Onboarding flow (welcome → password → seed → complete)
 * - Main wallet view
 * - Voice commands (optional feature)
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { VoicePanel } from './components/VoicePanel';
import { FullDuplexVoicePanel } from './components/FullDuplexVoicePanel';
import { AgentEvent } from '../services/agent-tools';
import { fetchSOLPrice, formatBalanceWithUSD } from '../services/price-service';
import unicornSignImg from './assets/unicorn-sign.png';
import QRCode from 'qrcode';

// State machine states
enum AppState {
  LOADING = "loading",
  ONBOARDING_WELCOME = "onboarding-welcome",
  ONBOARDING_PASSWORD = "onboarding-password",
  ONBOARDING_SEED = "onboarding-seed",
  ONBOARDING_COMPLETE = "onboarding-complete",
  WALLET_UNLOCK = "wallet-unlock",
  WALLET_MAIN = "wallet-main",
  APPROVE_CONNECTION = "approve-connection",
  APPROVE_TRANSACTION = "approve-transaction",
  SEND_TRANSACTION = "send-transaction",
  SEND_SUCCESS = "send-success",
  SETTINGS = "settings",
  REVIEW_SEED_PASSWORD = "review-seed-password",
  REVIEW_SEED_DISPLAY = "review-seed-display",
  TRANSACTION_HISTORY = "transaction-history",
  CONTACTS = "contacts",
  ADD_CONTACT = "add-contact",
  APPROVED_DAPPS = "approved-dapps",
}

interface Contact {
  id: string;
  name: string;
  address: string;
  addedAt: number;
}

interface ApprovedDapp {
  origin: string;
  hostname: string;
  approvedAt: number;
  dailyLimit: number; // in SOL
  dailyLimitUSD: number; // in USD
  spentToday: number; // in SOL
  lastResetDate: string; // YYYY-MM-DD
}

let currentState: AppState = AppState.LOADING;
let currentMnemonic: string | null = null; // Used in createWallet flow
let publicKey: string | null = null;
let pendingApprovalRequest: any = null;
let currentBalance: number = 0;
let estimatedFee: number = 0.000005; // Default Solana fee
let voiceModeEnabled: boolean = false;
let useFullDuplexVoice: boolean = true; // Use full duplex by default

// Get DOM elements (existing wallet view)
const addressEl = document.getElementById("address");
const balanceEl = document.getElementById("balance");
const copyBtn = document.getElementById("copy-btn");
const resetBtn = document.getElementById("reset-btn");
const refreshBalanceBtn = document.getElementById("refresh-balance-btn");
const toast = document.getElementById("toast");

// Get onboarding elements
const welcomeScreen = document.getElementById("onboarding-welcome")!;
const passwordScreen = document.getElementById("onboarding-password")!;
const seedScreen = document.getElementById("onboarding-seed")!;
const completeScreen = document.getElementById("onboarding-complete")!;
const unlockScreen = document.getElementById("wallet-unlock")!;
const approveConnectionScreen = document.getElementById("approve-connection")!;
const approveTransactionScreen = document.getElementById("approve-transaction")!;
const sendTransactionScreen = document.getElementById("send-transaction")!;
const sendSuccessScreen = document.getElementById("send-success")!;
const settingsScreen = document.getElementById("settings-screen")!;
const reviewSeedPasswordScreen = document.getElementById("review-seed-password")!;
const reviewSeedDisplayScreen = document.getElementById("review-seed-display")!;
const transactionHistoryScreen = document.getElementById("transaction-history")!;
const contactsScreen = document.getElementById("contacts-screen")!;
const addContactScreen = document.getElementById("add-contact-screen")!;
const approvedDappsScreen = document.getElementById("approved-dapps-screen")!;
const mainWallet = document.getElementById("main-wallet")!;

const btnStart = document.getElementById("btn-start") as HTMLButtonElement;
const btnCreateWallet = document.getElementById("btn-create-wallet") as HTMLButtonElement;
const btnSeedContinue = document.getElementById("btn-seed-continue") as HTMLButtonElement;
const btnOpenWallet = document.getElementById("btn-open-wallet") as HTMLButtonElement;
const btnUnlockWallet = document.getElementById("btn-unlock-wallet") as HTMLButtonElement;
const btnApproveConnection = document.getElementById("btn-approve-connection") as HTMLButtonElement;
const btnRejectConnection = document.getElementById("btn-reject-connection") as HTMLButtonElement;
const btnApproveTransaction = document.getElementById("btn-approve-transaction") as HTMLButtonElement;
const btnRejectTransaction = document.getElementById("btn-reject-transaction") as HTMLButtonElement;
const btnSend = document.getElementById("send-btn") as HTMLButtonElement;
const btnMaxAmount = document.getElementById("btn-max-amount") as HTMLButtonElement;
const btnCancelSend = document.getElementById("btn-cancel-send") as HTMLButtonElement;
const btnReviewTransaction = document.getElementById("btn-review-transaction") as HTMLButtonElement;
const btnDoneSend = document.getElementById("btn-done-send") as HTMLButtonElement;
const btnReviewSeed = document.getElementById("btn-review-seed") as HTMLButtonElement;
const btnDeleteWallet = document.getElementById("btn-delete-wallet") as HTMLButtonElement;
const btnCancelSettings = document.getElementById("btn-cancel-settings") as HTMLButtonElement;
const btnVerifyReviewPassword = document.getElementById("btn-verify-review-password") as HTMLButtonElement;
const btnCancelReviewSeed = document.getElementById("btn-cancel-review-seed") as HTMLButtonElement;
const btnDoneReviewSeed = document.getElementById("btn-done-review-seed") as HTMLButtonElement;
const btnCloseHistory = document.getElementById("btn-close-history") as HTMLButtonElement;
const btnCloseContacts = document.getElementById("btn-close-contacts") as HTMLButtonElement;
const btnAddContact = document.getElementById("btn-add-contact") as HTMLButtonElement;
const btnSaveContact = document.getElementById("btn-save-contact") as HTMLButtonElement;
const btnCancelAddContact = document.getElementById("btn-cancel-add-contact") as HTMLButtonElement;
const btnApprovedDapps = document.getElementById("btn-approved-dapps") as HTMLButtonElement;
const btnCloseDapps = document.getElementById("btn-close-dapps") as HTMLButtonElement;
const btnAddDapp = document.getElementById("btn-add-dapp") as HTMLButtonElement;

const inputPassword = document.getElementById("input-password") as HTMLInputElement;
const inputPasswordConfirm = document.getElementById(
  "input-password-confirm"
) as HTMLInputElement;
const inputUnlockPassword = document.getElementById("input-unlock-password") as HTMLInputElement;
const checkboxBackup = document.getElementById("checkbox-backup") as HTMLInputElement;
const seedWordsEl = document.getElementById("seed-words")!;
const passwordError = document.getElementById("password-error")!;
const unlockError = document.getElementById("unlock-error")!;
const linkForgotPassword = document.getElementById("link-forgot-password")!;
const inputReviewPassword = document.getElementById("input-review-password") as HTMLInputElement;
const reviewPasswordError = document.getElementById("review-password-error")!;
const reviewSeedWordsEl = document.getElementById("review-seed-words")!;

// Contact form elements
const inputContactName = document.getElementById("input-contact-name") as HTMLInputElement;
const inputContactAddress = document.getElementById("input-contact-address") as HTMLInputElement;
const contactNameError = document.getElementById("contact-name-error")!;
const contactAddressError = document.getElementById("contact-address-error")!;

// Send transaction elements
const inputRecipientAddress = document.getElementById("input-recipient-address") as HTMLInputElement;
const inputSendAmount = document.getElementById("input-send-amount") as HTMLInputElement;
const sendAvailableBalance = document.getElementById("send-available-balance")!;
const recipientError = document.getElementById("recipient-error")!;
const amountError = document.getElementById("amount-error")!;
const feeEstimateText = document.getElementById("fee-estimate-text")!;
const transactionSignature = document.getElementById("transaction-signature")!;
const linkViewExplorer = document.getElementById("link-view-explorer") as HTMLAnchorElement;

// Voice panel elements (created dynamically)
let voicePanelContainer: HTMLDivElement | null = null;
let voiceToggleBtn: HTMLButtonElement | null = null;

// Event bus for sending events to voice agent
let agentEventCallback: ((event: AgentEvent) => void) | null = null;

// New UI elements
const unicornImg = document.getElementById("unicorn-img") as HTMLImageElement;
const addressShort = document.getElementById("address-short");
const micPulse = document.getElementById("mic-pulse");
const historyBtn = document.getElementById("history-btn");
const contactsBtn = document.getElementById("contacts-btn");
const settingsBtn = document.getElementById("settings-btn");

// Settings elements
const volumeSlider = document.getElementById("volume-slider") as HTMLInputElement;
const volumeValue = document.getElementById("volume-value");
const microphoneSelect = document.getElementById("microphone-select") as HTMLSelectElement;

// QR Code dialog elements
const qrBtn = document.getElementById("qr-btn");
const qrDialog = document.getElementById("qr-dialog")!;
const qrCloseBtn = document.getElementById("qr-close-btn")!;
const qrCanvas = document.getElementById("qr-canvas") as HTMLCanvasElement;
const qrAddressDisplay = document.getElementById("qr-address-display")!;
const qrCopyBtn = document.getElementById("qr-copy-btn")!;

// Screen navigation
function showScreen(state: AppState) {
  // Hide all screens
  welcomeScreen.style.display = "none";
  passwordScreen.style.display = "none";
  seedScreen.style.display = "none";
  completeScreen.style.display = "none";
  unlockScreen.style.display = "none";
  approveConnectionScreen.style.display = "none";
  approveTransactionScreen.style.display = "none";
  sendTransactionScreen.style.display = "none";
  sendSuccessScreen.style.display = "none";
  settingsScreen.style.display = "none";
  reviewSeedPasswordScreen.style.display = "none";
  reviewSeedDisplayScreen.style.display = "none";
  transactionHistoryScreen.style.display = "none";
  contactsScreen.style.display = "none";
  addContactScreen.style.display = "none";
  approvedDappsScreen.style.display = "none";
  mainWallet.style.display = "none";

  // Show target screen
  currentState = state;
  switch (state) {
    case AppState.ONBOARDING_WELCOME:
      welcomeScreen.style.display = "block";
      break;
    case AppState.ONBOARDING_PASSWORD:
      passwordScreen.style.display = "block";
      break;
    case AppState.ONBOARDING_SEED:
      seedScreen.style.display = "block";
      break;
    case AppState.ONBOARDING_COMPLETE:
      completeScreen.style.display = "block";
      break;
    case AppState.WALLET_UNLOCK:
      unlockScreen.style.display = "block";
      // Auto-focus password field
      setTimeout(() => inputUnlockPassword.focus(), 100);
      break;
    case AppState.APPROVE_CONNECTION:
      approveConnectionScreen.style.display = "block";
      break;
    case AppState.APPROVE_TRANSACTION:
      approveTransactionScreen.style.display = "block";
      break;
    case AppState.SEND_TRANSACTION:
      sendTransactionScreen.style.display = "block";
      // Auto-focus recipient address field
      setTimeout(() => inputRecipientAddress.focus(), 100);
      break;
    case AppState.SEND_SUCCESS:
      sendSuccessScreen.style.display = "block";
      break;
    case AppState.SETTINGS:
      settingsScreen.style.display = "block";
      break;
    case AppState.REVIEW_SEED_PASSWORD:
      reviewSeedPasswordScreen.style.display = "block";
      // Auto-focus password field
      setTimeout(() => inputReviewPassword.focus(), 100);
      break;
    case AppState.REVIEW_SEED_DISPLAY:
      reviewSeedDisplayScreen.style.display = "block";
      break;
    case AppState.TRANSACTION_HISTORY:
      transactionHistoryScreen.style.display = "block";
      break;
    case AppState.CONTACTS:
      contactsScreen.style.display = "block";
      loadContacts();
      break;
    case AppState.ADD_CONTACT:
      addContactScreen.style.display = "block";
      // Auto-focus contact name field
      setTimeout(() => inputContactName.focus(), 100);
      break;
    case AppState.APPROVED_DAPPS:
      approvedDappsScreen.style.display = "block";
      loadApprovedDapps();
      break;
    case AppState.WALLET_MAIN:
      mainWallet.style.display = "block";
      void loadFamilyPanel();
      break;
  }
}

// Toast notification (existing)
function showToast(message: string) {
  if (!toast) {
    console.log("Toast:", message);
    return;
  }
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

// Helper function to shorten addresses
function shortenAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
}

// QR Code dialog functions
async function showQRCodeDialog() {
  if (!publicKey) {
    showToast("No address available");
    return;
  }

  try {
    // Generate QR code on canvas
    await QRCode.toCanvas(qrCanvas, publicKey, {
      width: 220,
      margin: 2,
      color: {
        dark: '#667eea',
        light: '#ffffff'
      }
    });

    // Update address display
    qrAddressDisplay.textContent = publicKey;

    // Show dialog
    qrDialog.style.display = "block";
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    showToast("Failed to generate QR code");
  }
}

function closeQRCodeDialog() {
  qrDialog.style.display = "none";
}

// Helper function to format date/time
function formatDate(timestamp: number | null): string {
  if (!timestamp) return "Unknown time";
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString();
}

// Helper function to send events to voice agent
function sendEventToAgent(type: string, data: Record<string, any>, context?: Record<string, any>): void {
  if (agentEventCallback) {
    const event: AgentEvent = {
      type,
      timestamp: Date.now(),
      data,
      context,
    };
    agentEventCallback(event);
    console.log('[Popup] Event sent to agent:', event);
  }
}

// Fetch and display transaction history
async function fetchTransactionHistory() {
  try {
    const historyList = document.getElementById("history-list")!;
    historyList.innerHTML = '<div style="text-align: center; padding: 20px; opacity: 0.7;">Loading...</div>';

    const response = await chrome.runtime.sendMessage({
      channel: "my-little-wallet",
      id: crypto.randomUUID(),
      method: "getTransactionHistory",
      params: { address: publicKey, limit: 20 },
    });

    if (response.ok && response.result?.transactions) {
      const transactions = response.result.transactions;

      if (transactions.length === 0) {
        historyList.innerHTML = `
          <div class="history-empty">
            <div class="history-empty-icon">📭</div>
            <div>No transactions yet</div>
          </div>
        `;
        return;
      }

      // Render transaction items
      historyList.innerHTML = "";
      transactions.forEach((tx: any) => {
        const isReceived = tx.to === publicKey;
        const isSent = tx.from === publicKey;
        const txType = isReceived ? "Received" : isSent ? "Sent" : "Unknown";
        const txIcon = isReceived ? "📥" : isSent ? "📤" : "❓";
        const amountClass = isReceived ? "history-item-amount" : "history-item-amount";
        const amountPrefix = isReceived ? "+" : "-";

        const item = document.createElement("div");
        item.className = "history-item";
        item.innerHTML = `
          <div class="history-item-header">
            <div class="history-item-type">
              <span>${txIcon}</span>
              <span>${txType}</span>
            </div>
            <div class="${amountClass}">
              ${tx.amount > 0 ? `${amountPrefix}${tx.amount.toFixed(4)} SOL` : ""}
            </div>
          </div>
          <div class="history-item-details">
            ${isSent ? `To: ${shortenAddress(tx.to)}` : isReceived ? `From: ${shortenAddress(tx.from)}` : ""}
          </div>
          <div class="history-item-time">
            ${formatDate(tx.blockTime)}
            ${tx.err ? ' • <span style="color: #ff6b6b;">Failed</span>' : ' • <span style="color: #4ade80;">Success</span>'}
          </div>
        `;

        // Click to view on explorer
        item.addEventListener("click", () => {
          const explorerUrl = `https://explorer.solana.com/tx/${tx.signature}`;
          chrome.tabs.create({ url: explorerUrl });
        });

        historyList.appendChild(item);
      });
    } else {
      historyList.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-icon">⚠️</div>
          <div>Failed to load history</div>
        </div>
      `;
    }
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    const historyList = document.getElementById("history-list")!;
    historyList.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">⚠️</div>
        <div>Error loading history</div>
      </div>
    `;
  }
}

// Set unicorn image
if (unicornImg) {
  unicornImg.src = unicornSignImg;
}

// Initialize voice panel UI
function initializeVoicePanel() {
  // Use existing mic button from HTML
  voiceToggleBtn = document.getElementById("voice-toggle-btn") as HTMLButtonElement;
  if (voiceToggleBtn) {
    voiceToggleBtn.addEventListener("click", toggleVoiceMode);
  }

  // Create voice panel container
  voicePanelContainer = document.createElement("div");
  voicePanelContainer.id = "voice-panel-container";
  voicePanelContainer.style.display = "none";

  // Insert after cards-row in main wallet
  const mainWallet = document.getElementById("main-wallet")!;
  const cardsRow = mainWallet.querySelector(".cards-row")!;
  cardsRow.insertAdjacentElement("afterend", voicePanelContainer);
}

// Toggle voice mode on/off
function toggleVoiceMode() {
  voiceModeEnabled = !voiceModeEnabled;
  renderVoicePanel();

  // Update mic pulse animation
  if (micPulse) {
    if (voiceModeEnabled) {
      micPulse.classList.add("active");
    } else {
      micPulse.classList.remove("active");
    }
  }
}

// Render voice panel React component
async function renderVoicePanel() {
  if (!voicePanelContainer) return;

  if (voiceModeEnabled && currentState === AppState.WALLET_MAIN) {
    // Load voice settings
    const settings = await chrome.storage.local.get(['voiceVolume', 'microphoneDeviceId']);
    const volume = settings.voiceVolume !== undefined ? settings.voiceVolume / 100 : 0.8;
    const microphoneId = settings.microphoneDeviceId || 'default';

    // Render appropriate voice panel based on mode
    if (useFullDuplexVoice) {
      ReactDOM.render(
        <FullDuplexVoicePanel
          onCommand={handleVoiceCommand}
          onToolCall={handleToolCall}
          onEvent={handleAgentEvent}
          isEnabled={true}
        />,
        voicePanelContainer
      );
    } else {
      ReactDOM.render(
        <VoicePanel
          onCommand={handleVoiceCommand}
          isEnabled={true}
        />,
        voicePanelContainer
      );
    }
    voicePanelContainer.style.display = "block";

    // Apply volume setting to audio elements after render
    setTimeout(() => {
      const audioElements = voicePanelContainer?.querySelectorAll('audio');
      audioElements?.forEach(audio => {
        audio.volume = volume;
      });
    }, 100);
  } else {
    voicePanelContainer.style.display = "none";
  }
}

// Handle tool calls from agent
function handleToolCall(toolName: string, params: any, result: any) {
  console.log('[Popup] Tool call:', toolName, params, result);
  showToast(`Agent tool: ${toolName}`);
}

// Handle events from agent
function handleAgentEvent(event: AgentEvent) {
  // Store callback for sending events back to agent
  agentEventCallback = (_evt) => {
    // This will be called by sendEventToAgent()
  };
  console.log('[Popup] Agent event:', event);
}

// Handle voice commands
async function handleVoiceCommand(action: string, params: any) {
  try {
    switch (action) {
      case "getBalance":
        await fetchBalance();
        showToast("Balance updated ✓");
        break;

      case "refreshBalance":
        await fetchBalance();
        showToast("Balance refreshed ✓");
        break;

      case "getAddress":
        if (publicKey) {
          showToast(`Address: ${publicKey.substring(0, 8)}...${publicKey.substring(publicKey.length - 8)}`);
        }
        break;

      case "copyAddress":
        if (publicKey) {
          await navigator.clipboard.writeText(publicKey);
          showToast("Address copied to clipboard! ✓");
        }
        break;

      case "sendTransaction":
        // Pre-fill send form with voice command data
        inputRecipientAddress.value = params.recipient || "";
        inputSendAmount.value = params.amount?.toString() || "";
        showScreen(AppState.SEND_TRANSACTION);
        validateSendForm();
        showToast("Send form ready. Please review and confirm.");
        break;

      case "unknown":
        showToast("Command not recognized. Try 'what's my balance?' or 'show my address'");
        break;

      default:
        showToast("Unknown command");
        break;
    }
  } catch (error: any) {
    console.error("Voice command error:", error);
    showToast(error.message || "Failed to execute command");
  }
}

// Check wallet initialization on startup
async function initializeApp() {
  try {
    // First, check for pending approval requests
    const pendingResponse = await chrome.runtime.sendMessage({
      channel: "my-little-wallet",
      id: crypto.randomUUID(),
      method: "getPendingApproval",
    });

    if (pendingResponse.ok && pendingResponse.result) {
      const approval = pendingResponse.result;

      // Store pending request
      pendingApprovalRequest = {
        channel: "my-little-wallet",
        id: approval.requestId,
        method: approval.type === 'connection' ? 'requestConnectionApproval' : 'requestTransactionApproval',
        params: approval,
      };

      // Show appropriate approval screen
      if (approval.type === 'connection') {
        // Update UI with origin
        const siteNameEl = document.getElementById("approval-site-name");
        const siteUrlEl = document.getElementById("approval-site-url");

        if (siteNameEl && approval.origin) {
          try {
            const url = new URL(approval.origin);
            siteNameEl.textContent = url.hostname;
            if (siteUrlEl) siteUrlEl.textContent = approval.origin;
          } catch (e) {
            siteNameEl.textContent = approval.origin;
            if (siteUrlEl) siteUrlEl.textContent = approval.origin;
          }
        }

        showScreen(AppState.APPROVE_CONNECTION);
        return;
      } else if (approval.type === 'transaction') {
        // Update UI with transaction details
        const txOriginEl = document.getElementById("tx-origin");
        const txAmountEl = document.getElementById("tx-amount");
        const txToEl = document.getElementById("tx-to");
        const txFromEl = document.getElementById("tx-from");

        if (txOriginEl) txOriginEl.textContent = approval.origin || "Unknown";
        if (txAmountEl) txAmountEl.textContent = approval.data?.amount ? `${approval.data.amount} SOL` : "Unknown";
        if (txToEl) txToEl.textContent = approval.data?.to || approval.data?.recipient || "Unknown";
        if (txFromEl) txFromEl.textContent = approval.data?.from || "Unknown";

        showScreen(AppState.APPROVE_TRANSACTION);
        return;
      }
    }

    // No pending approvals - proceed with normal initialization
    const response = await chrome.runtime.sendMessage({
      channel: "my-little-wallet",
      id: crypto.randomUUID(),
      method: "checkWalletInitialized",
    });

    if (response.ok && response.result.initialized) {
      // Wallet exists - try to load it (may be locked)
      try {
        await loadWallet();
      } catch (error: any) {
        // Check if wallet is locked
        const errorMsg = error?.message || String(error);
        if (errorMsg.includes("locked") || errorMsg.includes("Wallet is locked")) {
          showScreen(AppState.WALLET_UNLOCK);
        } else {
          throw error;
        }
      }
    } else {
      // No wallet - show onboarding
      showScreen(AppState.ONBOARDING_WELCOME);
    }
  } catch (error) {
    console.error("Failed to check wallet:", error);
    showToast("Error checking wallet status");
    showScreen(AppState.ONBOARDING_WELCOME);
  }
}

// Load existing wallet
async function loadWallet() {
  const response = await chrome.runtime.sendMessage({
    channel: "my-little-wallet",
    id: crypto.randomUUID(),
    method: "connect",
  });

  if (response.ok && response.result?.publicKey) {
    publicKey = response.result.publicKey;
    console.log("LoadWallet success - publicKey:", publicKey);
    console.log("addressShort element:", addressShort);

    if (addressEl) {
      addressEl.textContent = publicKey;
    }

    // Update shortened address display
    if (addressShort && publicKey) {
      const addr: string = publicKey;
      const shortened = shortenAddress(addr);
      console.log("Setting addressShort to:", shortened);
      addressShort.textContent = shortened;
    } else {
      console.error("Cannot update address - addressShort:", addressShort, "publicKey:", publicKey);
    }

    showScreen(AppState.WALLET_MAIN);

    // Ensure address is displayed after screen is shown
    if (addressShort && publicKey) {
      const addr: string = publicKey;
      const shortened = shortenAddress(addr);
      console.log("Re-setting addressShort after showScreen to:", shortened);
      addressShort.textContent = shortened;
    } else {
      console.error("Cannot re-update address - addressShort:", addressShort, "publicKey:", publicKey);
    }

    // Fetch balance after loading wallet
    await fetchBalance();
  } else {
    // Check if error indicates locked wallet
    const errorMsg = response.error?.message || response.error || "";
    if (String(errorMsg).includes("locked")) {
      throw new Error("Wallet is locked");
    }
    if (addressEl) {
      addressEl.textContent = "Error loading wallet";
    }
    if (addressShort) {
      addressShort.textContent = "Error";
    }
    console.error("Failed to load wallet:", response);
    throw new Error("Failed to load wallet");
  }
}

// Fetch balance from Solana network
async function fetchBalance() {
  try {
    if (balanceEl) {
      balanceEl.textContent = "Loading...";
    }

    const response = await chrome.runtime.sendMessage({
      channel: "my-little-wallet",
      id: crypto.randomUUID(),
      method: "getBalance",
      params: { address: publicKey },
    });

    if (response.ok && typeof response.result?.balance === 'number') {
      const balance = response.result.balance;
      currentBalance = balance; // Store for send flow

      // Fetch SOL price
      const solPrice = await fetchSOLPrice();
      const formatted = formatBalanceWithUSD(balance, solPrice);

      // Show balance with 2 decimals and USD value
      if (balanceEl) {
        balanceEl.textContent = `${formatted.sol} SOL ($${formatted.usd})`;
      }
      showToast("Balance updated ✓");
      void loadFamilyPanel();

      // Send balance update event to agent with USD value
      sendEventToAgent('balance_updated', {
        balance,
        balanceUSD: formatted.usdValue,
        solPrice,
        asset: 'SOL',
        address: publicKey || '',
      });
    } else {
      if (balanceEl) {
        balanceEl.textContent = "Error";
      }
      console.error("Failed to fetch balance:", response);
    }
  } catch (error) {
    console.error("Error fetching balance:", error);
    if (balanceEl) {
      balanceEl.textContent = "Error loading balance";
    }
    showToast("Failed to fetch balance");
  }
}

// Onboarding: Start button
btnStart.addEventListener("click", () => {
  showScreen(AppState.ONBOARDING_PASSWORD);
});

// Onboarding: Create wallet button
btnCreateWallet.addEventListener("click", async () => {
  const password = inputPassword.value;
  const passwordConfirm = inputPasswordConfirm.value;

  // Validation
  if (!password || password.length < 8) {
    passwordError.textContent = "Password must be at least 8 characters";
    passwordError.classList.add("show");
    return;
  }

  if (password !== passwordConfirm) {
    passwordError.textContent = "Passwords do not match";
    passwordError.classList.add("show");
    return;
  }

  passwordError.classList.remove("show");

  try {
    // Create wallet via RPC
    const response = await chrome.runtime.sendMessage({
      channel: "my-little-wallet",
      id: crypto.randomUUID(),
      method: "createWallet",
      params: { password },
    });

    if (response.ok && response.result?.mnemonic) {
      currentMnemonic = response.result.mnemonic;
      displaySeedPhrase(response.result.mnemonic);
      showScreen(AppState.ONBOARDING_SEED);
    } else {
      showToast("Failed to create wallet");
      console.error("Wallet creation error:", response);
    }
  } catch (error) {
    console.error("Error creating wallet:", error);
    showToast("Error creating wallet");
  }
});

// Display seed phrase
function displaySeedPhrase(mnemonic: string) {
  const words = mnemonic.split(" ");
  seedWordsEl.innerHTML = "";

  words.forEach((word, index) => {
    const wordEl = document.createElement("div");
    wordEl.className = "seed-word";
    wordEl.textContent = `${index + 1}. ${word}`;
    seedWordsEl.appendChild(wordEl);
  });
}

// Seed phrase: Backup checkbox
checkboxBackup.addEventListener("change", () => {
  btnSeedContinue.disabled = !checkboxBackup.checked;
});

// Seed phrase: Continue button
btnSeedContinue.addEventListener("click", () => {
  showScreen(AppState.ONBOARDING_COMPLETE);
});

// Setup complete: Open wallet button
btnOpenWallet.addEventListener("click", async () => {
  await loadWallet();
});

// Unlock: Unlock wallet button
btnUnlockWallet.addEventListener("click", async () => {
  const password = inputUnlockPassword.value;

  // Validation
  if (!password) {
    unlockError.textContent = "Password is required";
    unlockError.classList.add("show");
    return;
  }

  unlockError.classList.remove("show");

  // Disable button during unlock
  btnUnlockWallet.disabled = true;
  btnUnlockWallet.textContent = "Unlocking...";

  try {
    // Unlock wallet via RPC
    const response = await chrome.runtime.sendMessage({
      channel: "my-little-wallet",
      id: crypto.randomUUID(),
      method: "unlockWallet",
      params: { password },
    });

    if (response.ok && response.result?.publicKey) {
      // Success - load wallet
      publicKey = response.result.publicKey;
      console.log("Unlock success - publicKey:", publicKey);
      console.log("addressShort element:", addressShort);

      if (addressEl) {
        addressEl.textContent = publicKey;
      }

      // Update shortened address display
      if (addressShort && publicKey) {
        const addr: string = publicKey;
        const shortened = shortenAddress(addr);
        console.log("Setting addressShort to:", shortened);
        addressShort.textContent = shortened;
      } else {
        console.error("Cannot update address - addressShort:", addressShort, "publicKey:", publicKey);
      }

      showScreen(AppState.WALLET_MAIN);

      // Clear password field
      inputUnlockPassword.value = "";

      // Fetch balance
      await fetchBalance();

      showToast("Wallet unlocked! ✓");
    } else {
      // Unlock failed
      unlockError.textContent = "Invalid password. Please try again.";
      unlockError.classList.add("show");
    }
  } catch (error) {
    console.error("Error unlocking wallet:", error);
    unlockError.textContent = "Failed to unlock wallet. Please try again.";
    unlockError.classList.add("show");
  } finally {
    // Re-enable button
    btnUnlockWallet.disabled = false;
    btnUnlockWallet.textContent = "Unlock Wallet";
  }
});

// Unlock: Enter key submits
inputUnlockPassword.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    btnUnlockWallet.click();
  }
});

// Unlock: Forgot password link
linkForgotPassword.addEventListener("click", (e) => {
  e.preventDefault();

  const message = `To recover your wallet, you need your 12-word seed phrase.\n\nIf you have your seed phrase:\n1. Click "Reset Wallet" in the main wallet screen\n2. Import your wallet using the seed phrase\n\nIf you don't have your seed phrase, your wallet cannot be recovered.`;

  alert(message);
});

// Existing wallet functionality (copy, reset)
if (refreshBalanceBtn) {
  refreshBalanceBtn.addEventListener("click", async () => {
    await fetchBalance();
  });
}

if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    if (!publicKey) {
      showToast("No address to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(publicKey);
      showToast("Address copied to clipboard! ✓");
    } catch (error) {
      console.error("Failed to copy:", error);
      showToast("Failed to copy address");
    }
  });
}

if (addressEl) {
  addressEl.addEventListener("click", async () => {
    if (publicKey) {
      try {
        await navigator.clipboard.writeText(publicKey);
        showToast("Address copied! ✓");
      } catch (error) {
        console.error("Failed to copy:", error);
      }
    }
  });
}

if (resetBtn) {
  resetBtn.addEventListener("click", async () => {
    const confirmed = confirm(
      "⚠️ WARNING ⚠️\n\nThis will DELETE your private key PERMANENTLY!\n\nAre you sure?"
    );
    if (!confirmed) return;

    const doubleConfirm = confirm(
      "This is your LAST CHANCE!\n\nClicking OK will DELETE YOUR PRIVATE KEY FOREVER.\n\nContinue?"
    );
    if (!doubleConfirm) return;

    try {
      await chrome.storage.local.clear();
      showToast("Wallet reset! Reload to create new wallet.");
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error("Failed to reset wallet:", error);
      showToast("Failed to reset wallet");
    }
  });
}

// QR Code button listeners
if (qrBtn) {
  qrBtn.addEventListener("click", () => {
    showQRCodeDialog();
  });
}

if (qrCloseBtn) {
  qrCloseBtn.addEventListener("click", () => {
    closeQRCodeDialog();
  });
}

if (qrCopyBtn) {
  qrCopyBtn.addEventListener("click", async () => {
    if (!publicKey) {
      showToast("No address to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(publicKey);
      showToast("Address copied to clipboard! ✓");
    } catch (error) {
      console.error("Failed to copy:", error);
      showToast("Failed to copy address");
    }
  });
}

// Close dialog when clicking outside
qrDialog.addEventListener("click", (e) => {
  if (e.target === qrDialog) {
    closeQRCodeDialog();
  }
});

// New UI button listeners
if (historyBtn) {
  historyBtn.addEventListener("click", async () => {
    showScreen(AppState.TRANSACTION_HISTORY);
    await fetchTransactionHistory();
  });
}

// Close history button
btnCloseHistory.addEventListener("click", () => {
  showScreen(AppState.WALLET_MAIN);
});

// Contacts button
if (contactsBtn) {
  contactsBtn.addEventListener("click", () => {
    showScreen(AppState.CONTACTS);
  });
}

// Close contacts button
btnCloseContacts.addEventListener("click", () => {
  showScreen(AppState.WALLET_MAIN);
});

// Add contact button
btnAddContact.addEventListener("click", () => {
  // Clear form
  inputContactName.value = "";
  inputContactAddress.value = "";
  contactNameError.classList.remove("show");
  contactAddressError.classList.remove("show");
  btnSaveContact.disabled = true;
  showScreen(AppState.ADD_CONTACT);
});

// Cancel add contact
btnCancelAddContact.addEventListener("click", () => {
  showScreen(AppState.CONTACTS);
});

// Save contact
btnSaveContact.addEventListener("click", async () => {
  const name = inputContactName.value.trim();
  const address = inputContactAddress.value.trim();

  if (!validateContactForm()) {
    return;
  }

  try {
    // Get existing contacts
    const storage = await chrome.storage.local.get(['contacts']);
    const contacts: Contact[] = storage.contacts || [];

    // Check for duplicate address
    const duplicate = contacts.find(c => c.address === address);
    if (duplicate) {
      contactAddressError.textContent = "This address is already saved";
      contactAddressError.classList.add("show");
      return;
    }

    // Add new contact
    const newContact: Contact = {
      id: crypto.randomUUID(),
      name,
      address,
      addedAt: Date.now(),
    };

    contacts.push(newContact);

    // Save to storage
    await chrome.storage.local.set({ contacts });

    showToast(`Contact "${name}" saved ✓`);
    showScreen(AppState.CONTACTS);
  } catch (error) {
    console.error("Error saving contact:", error);
    showToast("Failed to save contact");
  }
});

// Load and display contacts
async function loadContacts() {
  try {
    const storage = await chrome.storage.local.get(['contacts']);
    const contacts: Contact[] = storage.contacts || [];

    const contactsList = document.getElementById("contacts-list")!;
    const contactsEmpty = document.getElementById("contacts-empty")!;

    if (contacts.length === 0) {
      contactsEmpty.style.display = "block";
      contactsList.innerHTML = '<div id="contacts-empty" style="text-align: center; padding: 40px 20px; opacity: 0.7;"><div style="font-size: 48px; margin-bottom: 12px;">📇</div><div style="font-size: 14px; margin-bottom: 8px; font-weight: 600;">No contacts yet</div><div style="font-size: 12px; opacity: 0.8;">Save addresses for quick sending</div></div>';
      return;
    }

    // Render contacts
    contactsList.innerHTML = "";
    contacts.forEach((contact) => {
      const contactEl = document.createElement("div");
      contactEl.className = "contact-item";
      contactEl.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 12px 14px;
        margin-bottom: 10px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        transition: transform 0.2s, background 0.2s;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      contactEl.innerHTML = `
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 14px; font-weight: 700; margin-bottom: 4px; font-family: var(--font-display);">${contact.name}</div>
          <div style="font-family: 'Courier New', monospace; font-size: 11px; opacity: 0.8; word-break: break-all;">${shortenAddress(contact.address)}</div>
        </div>
        <button class="delete-contact-btn" data-id="${contact.id}" style="background: rgba(255, 107, 107, 0.8); border: 2px solid white; border-radius: 8px; padding: 6px 10px; color: white; font-weight: 700; font-size: 12px; cursor: pointer; margin-left: 10px; transition: transform 0.2s;">
          🗑️
        </button>
      `;

      // Click to use in send
      contactEl.addEventListener("click", (e) => {
        // Don't trigger if clicking delete button
        if ((e.target as HTMLElement).classList.contains("delete-contact-btn")) {
          return;
        }

        // Pre-fill send form with contact address
        inputRecipientAddress.value = contact.address;
        showScreen(AppState.SEND_TRANSACTION);
        validateSendForm();
        showToast(`Sending to ${contact.name}`);
      });

      // Delete button
      const deleteBtn = contactEl.querySelector(".delete-contact-btn");
      deleteBtn?.addEventListener("click", async (e) => {
        e.stopPropagation();

        const confirmed = confirm(`Delete contact "${contact.name}"?`);
        if (!confirmed) return;

        try {
          const storage = await chrome.storage.local.get(['contacts']);
          const contacts: Contact[] = storage.contacts || [];
          const updated = contacts.filter(c => c.id !== contact.id);
          await chrome.storage.local.set({ contacts: updated });
          showToast(`Contact "${contact.name}" deleted`);
          loadContacts();
        } catch (error) {
          console.error("Error deleting contact:", error);
          showToast("Failed to delete contact");
        }
      });

      contactsList.appendChild(contactEl);
    });
  } catch (error) {
    console.error("Error loading contacts:", error);
  }
}

// Validate contact form
function validateContactForm(): boolean {
  let isValid = true;

  const name = inputContactName.value.trim();
  const address = inputContactAddress.value.trim();

  // Validate name
  if (!name) {
    contactNameError.textContent = "Name is required";
    contactNameError.classList.add("show");
    isValid = false;
  } else if (name.length > 30) {
    contactNameError.textContent = "Name is too long (max 30 characters)";
    contactNameError.classList.add("show");
    isValid = false;
  } else {
    contactNameError.classList.remove("show");
  }

  // Validate address
  if (!address) {
    contactAddressError.textContent = "Address is required";
    contactAddressError.classList.add("show");
    isValid = false;
  } else if (!validateAddress(address)) {
    contactAddressError.textContent = "Invalid Solana address";
    contactAddressError.classList.add("show");
    isValid = false;
  } else {
    contactAddressError.classList.remove("show");
  }

  // Enable/disable save button
  btnSaveContact.disabled = !isValid;

  return isValid;
}

// Real-time validation for contact form
inputContactName.addEventListener("input", validateContactForm);
inputContactAddress.addEventListener("input", validateContactForm);

// Approved Dapps button
btnApprovedDapps.addEventListener("click", () => {
  showScreen(AppState.APPROVED_DAPPS);
});

// Close approved dapps button
btnCloseDapps.addEventListener("click", () => {
  showScreen(AppState.SETTINGS);
});

// Add dapp manually button
btnAddDapp.addEventListener("click", async () => {
  const url = prompt("Enter dapp URL (e.g., https://example.com):");
  if (!url) return;

  try {
    const urlObj = new URL(url);
    const limitStr = prompt(`Enter daily spending limit in USD for ${urlObj.hostname}:`, "100");
    if (!limitStr) return;

    const limit = parseFloat(limitStr);
    if (isNaN(limit) || limit < 0) {
      showToast("Invalid limit amount");
      return;
    }

    await manuallyAddDapp(url, urlObj.hostname, limit);
  } catch (error) {
    showToast("Invalid URL");
  }
});

// Helper function to manually add a dapp (for testing/demo)
async function manuallyAddDapp(origin: string, hostname: string, dailyLimitUSD: number = 100) {
  try {
    const storage = await chrome.storage.local.get(['approvedDapps']);
    const dapps: ApprovedDapp[] = storage.approvedDapps || [];

    // Check if already exists
    const existing = dapps.find(d => d.origin === origin);
    if (existing) {
      showToast(`${hostname} is already approved`);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const solPrice = await fetchSOLPrice();
    const dailyLimitSOL = solPrice > 0 ? dailyLimitUSD / solPrice : 1.0;

    const newDapp: ApprovedDapp = {
      origin,
      hostname,
      approvedAt: Date.now(),
      dailyLimit: dailyLimitSOL,
      dailyLimitUSD: dailyLimitUSD,
      spentToday: 0,
      lastResetDate: today,
    };

    dapps.push(newDapp);
    await chrome.storage.local.set({ approvedDapps: dapps });
    showToast(`${hostname} added with $${dailyLimitUSD} daily limit`);

    // Reload the dapps list if we're on that screen
    if (currentState === AppState.APPROVED_DAPPS) {
      loadApprovedDapps();
    }
  } catch (error) {
    console.error("Error manually adding dapp:", error);
    showToast("Failed to add dapp");
  }
}

// Load and display approved dapps with spend limits
async function loadApprovedDapps() {
  try {
    const storage = await chrome.storage.local.get(['approvedDapps']);
    const dapps: ApprovedDapp[] = storage.approvedDapps || [];

    // Reset daily spend if needed
    const today = new Date().toISOString().split('T')[0];
    const solPrice = await fetchSOLPrice();

    const updatedDapps = dapps.map(dapp => {
      if (dapp.lastResetDate !== today) {
        return {
          ...dapp,
          spentToday: 0,
          lastResetDate: today,
        };
      }
      return dapp;
    });

    // Save updated dapps if any were reset
    if (JSON.stringify(dapps) !== JSON.stringify(updatedDapps)) {
      await chrome.storage.local.set({ approvedDapps: updatedDapps });
    }

    const dappsList = document.getElementById("dapps-list")!;
    const dappsEmpty = document.getElementById("dapps-empty")!;

    if (updatedDapps.length === 0) {
      dappsEmpty.style.display = "block";
      dappsList.innerHTML = '<div id="dapps-empty" style="text-align: center; padding: 40px 20px; opacity: 0.7;"><div style="font-size: 48px; margin-bottom: 12px;">🔐</div><div style="font-size: 14px; margin-bottom: 8px; font-weight: 600;">No approved dapps</div><div style="font-size: 12px; opacity: 0.8;">Connect to a dapp to see it here</div></div>';
      return;
    }

    // Render dapps
    dappsList.innerHTML = "";
    updatedDapps.forEach((dapp) => {
      const spentPercent = dapp.dailyLimit > 0 ? (dapp.spentToday / dapp.dailyLimit) * 100 : 0;
      const remaining = Math.max(0, dapp.dailyLimit - dapp.spentToday);
      const remainingUSD = remaining * solPrice;
      const spentUSD = dapp.spentToday * solPrice;
      const barColor = spentPercent >= 90 ? '#ff6b6b' : spentPercent >= 70 ? '#ffa500' : '#7BC043';

      const dappEl = document.createElement("div");
      dappEl.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 12px;
        border: 2px solid rgba(255, 255, 255, 0.2);
      `;

      dappEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 14px; font-weight: 700; margin-bottom: 2px; font-family: var(--font-display);">🌐 ${dapp.hostname}</div>
            <div style="font-size: 11px; opacity: 0.7;">Connected ${new Date(dapp.approvedAt).toLocaleDateString()}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="open-dapp-btn" data-origin="${dapp.origin}" style="background: linear-gradient(to bottom, var(--color-brand-green), #5A9A28); border: 2px solid white; border-radius: 8px; padding: 6px 12px; color: white; font-weight: 700; font-size: 11px; cursor: pointer; transition: transform 0.2s;">
              🚀 Open
            </button>
            <button class="revoke-dapp-btn" data-origin="${dapp.origin}" style="background: rgba(255, 107, 107, 0.8); border: 2px solid white; border-radius: 8px; padding: 6px 10px; color: white; font-weight: 700; font-size: 11px; cursor: pointer; transition: transform 0.2s;">
              Revoke
            </button>
          </div>
        </div>

        <!-- Daily Limit Section -->
        <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; margin-top: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 600;">Daily Limit:</span>
            <span style="font-size: 11px; font-weight: 700;">$${dapp.dailyLimitUSD.toFixed(0)} (${dapp.dailyLimit.toFixed(2)} SOL)</span>
          </div>

          <!-- Progress Bar -->
          <div style="background: rgba(255,255,255,0.2); border-radius: 6px; height: 18px; overflow: hidden; margin-bottom: 6px; position: relative;">
            <div style="background: ${barColor}; height: 100%; width: ${Math.min(spentPercent, 100)}%; transition: width 0.3s, background-color 0.3s; border-radius: 6px;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 10px; font-weight: 700; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
              ${spentPercent.toFixed(1)}%
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 10px; opacity: 0.8;">
            <span>Spent: $${spentUSD.toFixed(2)}</span>
            <span>Left: $${remainingUSD.toFixed(2)}</span>
          </div>

          <!-- Edit Limit Button -->
          <button class="edit-limit-btn" data-origin="${dapp.origin}" style="width: 100%; margin-top: 8px; padding: 6px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; color: white; font-size: 11px; font-weight: 600; cursor: pointer; transition: background 0.2s;">
            ✏️ Edit Limit
          </button>
        </div>
      `;

      // Open dapp button
      const openBtn = dappEl.querySelector(".open-dapp-btn");
      openBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url: dapp.origin });
      });

      // Revoke button
      const revokeBtn = dappEl.querySelector(".revoke-dapp-btn");
      revokeBtn?.addEventListener("click", async (e) => {
        e.stopPropagation();

        const confirmed = confirm(`Revoke access for ${dapp.hostname}?`);
        if (!confirmed) return;

        try {
          const storage = await chrome.storage.local.get(['approvedDapps']);
          const dapps: ApprovedDapp[] = storage.approvedDapps || [];
          const updated = dapps.filter(d => d.origin !== dapp.origin);
          await chrome.storage.local.set({ approvedDapps: updated });
          showToast(`${dapp.hostname} access revoked`);
          loadApprovedDapps();
        } catch (error) {
          console.error("Error revoking dapp:", error);
          showToast("Failed to revoke access");
        }
      });

      // Edit limit button
      const editBtn = dappEl.querySelector(".edit-limit-btn");
      editBtn?.addEventListener("click", async () => {
        const newLimitUSD = prompt(`Enter new daily limit for ${dapp.hostname} (in USD):`, dapp.dailyLimitUSD.toString());
        if (newLimitUSD === null) return;

        const limitUSD = parseFloat(newLimitUSD);
        if (isNaN(limitUSD) || limitUSD < 0) {
          showToast("Invalid limit amount");
          return;
        }

        try {
          const solPrice = await fetchSOLPrice();
          const limitSOL = solPrice > 0 ? limitUSD / solPrice : limitUSD;

          const storage = await chrome.storage.local.get(['approvedDapps']);
          const dapps: ApprovedDapp[] = storage.approvedDapps || [];
          const updated = dapps.map(d =>
            d.origin === dapp.origin ? { ...d, dailyLimit: limitSOL, dailyLimitUSD: limitUSD } : d
          );
          await chrome.storage.local.set({ approvedDapps: updated });
          showToast(`Daily limit updated to $${limitUSD}`);
          loadApprovedDapps();
        } catch (error) {
          console.error("Error updating limit:", error);
          showToast("Failed to update limit");
        }
      });

      dappsList.appendChild(dappEl);
    });
  } catch (error) {
    console.error("Error loading approved dapps:", error);
  }
}

if (settingsBtn) {
  settingsBtn.addEventListener("click", async () => {
    showScreen(AppState.SETTINGS);
    // Load current settings when opening settings screen
    await loadSettings();
    // Populate microphone options
    await populateMicrophoneOptions();
  });
}

// Volume slider handler
if (volumeSlider && volumeValue) {
  volumeSlider.addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value;
    volumeValue.textContent = `${value}%`;
    // Save volume setting
    saveVolumeSetting(parseInt(value));
  });
}

// Microphone select handler
if (microphoneSelect) {
  microphoneSelect.addEventListener("change", (e) => {
    const deviceId = (e.target as HTMLSelectElement).value;
    // Save microphone setting
    saveMicrophoneSetting(deviceId);
  });
}

// Load settings from storage
async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get(['voiceVolume', 'microphoneDeviceId']);

    // Load volume
    if (settings.voiceVolume !== undefined && volumeSlider && volumeValue) {
      volumeSlider.value = settings.voiceVolume.toString();
      volumeValue.textContent = `${settings.voiceVolume}%`;
    }

    // Load microphone selection
    if (settings.microphoneDeviceId && microphoneSelect) {
      microphoneSelect.value = settings.microphoneDeviceId;
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

// Save volume setting
async function saveVolumeSetting(volume: number) {
  try {
    await chrome.storage.local.set({ voiceVolume: volume });
    console.log("Volume saved:", volume);
  } catch (error) {
    console.error("Failed to save volume:", error);
  }
}

// Save microphone setting
async function saveMicrophoneSetting(deviceId: string) {
  try {
    await chrome.storage.local.set({ microphoneDeviceId: deviceId });
    console.log("Microphone saved:", deviceId);
    showToast("Microphone updated ✓");
  } catch (error) {
    console.error("Failed to save microphone:", error);
  }
}

// Populate microphone options
async function populateMicrophoneOptions() {
  if (!microphoneSelect) return;

  try {
    // Request microphone permission and get devices
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');

    // Clear existing options
    microphoneSelect.innerHTML = '';

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = 'default';
    defaultOption.textContent = 'Default Microphone';
    microphoneSelect.appendChild(defaultOption);

    // Add available microphones
    audioInputs.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${index + 1}`;
      microphoneSelect.appendChild(option);
    });

    // Load saved selection
    const settings = await chrome.storage.local.get(['microphoneDeviceId']);
    if (settings.microphoneDeviceId) {
      microphoneSelect.value = settings.microphoneDeviceId;
    }
  } catch (error) {
    console.error("Failed to enumerate microphones:", error);
    // Keep default option if enumeration fails
  }
}

// Settings: Review Seed button
btnReviewSeed.addEventListener("click", () => {
  // Clear previous input and errors
  inputReviewPassword.value = "";
  reviewPasswordError.classList.remove("show");
  showScreen(AppState.REVIEW_SEED_PASSWORD);
});

// Settings: Delete Wallet button
btnDeleteWallet.addEventListener("click", async () => {
  const confirmed = confirm(
    "⚠️ WARNING ⚠️\n\nThis will DELETE your private key PERMANENTLY!\n\nMake sure you have your seed phrase backed up!\n\nAre you sure?"
  );
  if (!confirmed) return;

  const doubleConfirm = confirm(
    "This is your LAST CHANCE!\n\nClicking OK will DELETE YOUR PRIVATE KEY FOREVER.\n\nContinue?"
  );
  if (!doubleConfirm) return;

  try {
    await chrome.storage.local.clear();
    showToast("Wallet deleted! Reload to create new wallet.");
    setTimeout(() => window.location.reload(), 2000);
  } catch (error) {
    console.error("Failed to delete wallet:", error);
    showToast("Failed to delete wallet");
  }
});

// Settings: Cancel button
btnCancelSettings.addEventListener("click", () => {
  showScreen(AppState.WALLET_MAIN);
});

// Review Seed: Verify password button
btnVerifyReviewPassword.addEventListener("click", async () => {
  const password = inputReviewPassword.value;

  // Validation
  if (!password) {
    reviewPasswordError.textContent = "Password is required";
    reviewPasswordError.classList.add("show");
    return;
  }

  reviewPasswordError.classList.remove("show");

  // Disable button during verification
  btnVerifyReviewPassword.disabled = true;
  btnVerifyReviewPassword.textContent = "Verifying...";

  try {
    // Get mnemonic via RPC
    const response = await chrome.runtime.sendMessage({
      channel: "my-little-wallet",
      id: crypto.randomUUID(),
      method: "getMnemonic",
      params: { password },
    });

    if (response.ok && response.result?.mnemonic) {
      // Success - display seed phrase
      displayReviewSeedPhrase(response.result.mnemonic);
      showScreen(AppState.REVIEW_SEED_DISPLAY);

      // Clear password field for security
      inputReviewPassword.value = "";
    } else {
      // Verification failed
      reviewPasswordError.textContent = "Invalid password. Please try again.";
      reviewPasswordError.classList.add("show");
    }
  } catch (error: any) {
    console.error("Error verifying password:", error);
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes("Invalid password")) {
      reviewPasswordError.textContent = "Invalid password. Please try again.";
    } else {
      reviewPasswordError.textContent = "Failed to retrieve seed phrase. Please try again.";
    }
    reviewPasswordError.classList.add("show");
  } finally {
    // Re-enable button
    btnVerifyReviewPassword.disabled = false;
    btnVerifyReviewPassword.textContent = "Continue";
  }
});

// Review Seed: Cancel button
btnCancelReviewSeed.addEventListener("click", () => {
  showScreen(AppState.SETTINGS);
  // Clear password for security
  inputReviewPassword.value = "";
});

// Review Seed: Done button
btnDoneReviewSeed.addEventListener("click", () => {
  showScreen(AppState.WALLET_MAIN);
  // Clear the displayed seed phrase for security
  reviewSeedWordsEl.innerHTML = "";
});

// Review Seed: Enter key submits
inputReviewPassword.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    btnVerifyReviewPassword.click();
  }
});

// Display seed phrase in review screen
function displayReviewSeedPhrase(mnemonic: string) {
  const words = mnemonic.split(" ");
  reviewSeedWordsEl.innerHTML = "";

  words.forEach((word, index) => {
    const wordEl = document.createElement("div");
    wordEl.className = "seed-word";
    wordEl.textContent = `${index + 1}. ${word}`;
    reviewSeedWordsEl.appendChild(wordEl);
  });
}

// Make shortened address clickable to copy
if (addressShort) {
  addressShort.addEventListener("click", async () => {
    if (publicKey) {
      try {
        await navigator.clipboard.writeText(publicKey);
        showToast("Address copied! ✓");
      } catch (error) {
        console.error("Failed to copy:", error);
        showToast("Failed to copy address");
      }
    }
  });
}

// Send Transaction Flow
btnSend.addEventListener("click", async () => {
  openSendForm("", "");
});

const TINY_SEND_SOL = 0.001;
const mayaAddressEl = document.getElementById("maya-address");
const mayaBalanceEl = document.getElementById("maya-balance");
const jarAddressEl = document.getElementById("jar-address");
const jarBalanceEl = document.getElementById("jar-balance");
const jarProgressBar = document.getElementById("jar-progress-bar");
const btnSendMaya = document.getElementById("btn-send-maya");
const btnFundJar = document.getElementById("btn-fund-jar");

function openSendForm(recipient: string, amount: string) {
  sendAvailableBalance.textContent = `${currentBalance.toFixed(9)} SOL`;
  feeEstimateText.textContent = `Estimated fee: ~${estimatedFee.toFixed(9)} SOL`;
  inputRecipientAddress.value = recipient;
  inputSendAmount.value = amount;
  recipientError.classList.remove("show");
  amountError.classList.remove("show");
  showScreen(AppState.SEND_TRANSACTION);
  validateSendForm();
}

async function loadFamilyPanel() {
  if (!mayaAddressEl || !jarAddressEl) return;
  try {
    const response = await chrome.runtime.sendMessage({
      channel: "my-little-wallet",
      id: crypto.randomUUID(),
      method: "getFamilyAccounts",
    });
    if (!response?.ok || !response.result) {
      mayaAddressEl.textContent = "Create a wallet first";
      return;
    }
    const { maya, jar, mayaBalance, jarBalance, jarTargetSol } = response.result;
    mayaAddressEl.textContent = shortenAddress(maya);
    mayaAddressEl.title = maya;
    if (mayaBalanceEl) {
      mayaBalanceEl.textContent = `${Number(mayaBalance).toFixed(4)} SOL`;
    }
    jarAddressEl.textContent = shortenAddress(jar);
    jarAddressEl.title = jar;
    if (jarBalanceEl) {
      jarBalanceEl.textContent = `${Number(jarBalance).toFixed(4)} / ${jarTargetSol} SOL`;
    }
    if (jarProgressBar) {
      const pct = Math.min(100, (Number(jarBalance) / Number(jarTargetSol || 0.01)) * 100);
      jarProgressBar.style.width = `${pct}%`;
    }
    if (btnSendMaya) {
      btnSendMaya.onclick = () => openSendForm(maya, String(TINY_SEND_SOL));
    }
    if (btnFundJar) {
      btnFundJar.onclick = () => openSendForm(jar, String(TINY_SEND_SOL));
    }
  } catch (error) {
    console.error("Failed to load family panel:", error);
  }
}

// Max button - fill with maximum available amount
btnMaxAmount.addEventListener("click", () => {
  const maxAmount = Math.max(0, currentBalance - estimatedFee);
  inputSendAmount.value = maxAmount.toFixed(9);
  validateSendForm();
});

// Cancel send - return to main wallet
btnCancelSend.addEventListener("click", () => {
  // Send cancellation event to agent
  sendEventToAgent('send_cancelled', {
    reason: 'user_cancelled',
  });

  showScreen(AppState.WALLET_MAIN);
});

// Validate address format (Solana base58 public key)
function validateAddress(address: string): boolean {
  if (!address || address.length === 0) {
    return false;
  }

  // Solana addresses are 32-44 characters, base58 encoded
  if (address.length < 32 || address.length > 44) {
    return false;
  }

  // Check if it's valid base58 (no 0, O, I, l characters)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(address);
}

// Validate send form
function validateSendForm(): boolean {
  let isValid = true;

  // Validate recipient address
  const recipient = inputRecipientAddress.value.trim();
  if (!recipient) {
    recipientError.textContent = "";
    recipientError.classList.remove("show");
  } else if (!validateAddress(recipient)) {
    recipientError.textContent = "Invalid Solana address";
    recipientError.classList.add("show");
    isValid = false;
  } else {
    recipientError.classList.remove("show");
  }

  // Validate amount
  const amountStr = inputSendAmount.value.trim();
  if (!amountStr) {
    amountError.textContent = "";
    amountError.classList.remove("show");
  } else {
    const amount = parseFloat(amountStr);

    if (isNaN(amount) || amount <= 0) {
      amountError.textContent = "Amount must be greater than 0";
      amountError.classList.add("show");
      isValid = false;
    } else if (amount + estimatedFee > currentBalance) {
      amountError.textContent = `Insufficient balance (need ${(amount + estimatedFee).toFixed(9)} SOL including fee)`;
      amountError.classList.add("show");
      isValid = false;
    } else {
      amountError.classList.remove("show");
    }
  }

  // Enable/disable review button
  btnReviewTransaction.disabled = !isValid || !recipient || !amountStr;

  return isValid;
}

// Real-time validation
inputRecipientAddress.addEventListener("input", validateSendForm);
inputSendAmount.addEventListener("input", validateSendForm);

// Review transaction - simulate and show approval
btnReviewTransaction.addEventListener("click", async () => {
  const recipient = inputRecipientAddress.value.trim();
  const amount = parseFloat(inputSendAmount.value.trim());

  if (!validateSendForm()) {
    return;
  }

  // Disable button during send
  btnReviewTransaction.disabled = true;
  btnReviewTransaction.textContent = "Sending...";

  // Send event to agent
  sendEventToAgent('send_initiated', {
    recipient,
    amount,
    asset: 'SOL',
  });

  try {
    // Send transaction directly (no simulation)
    const sendResponse = await chrome.runtime.sendMessage({
      channel: "my-little-wallet",
      id: crypto.randomUUID(),
      method: "sendTransaction",
      params: {
        from: publicKey,
        to: recipient,
        amount: amount,
      },
    });

    if (sendResponse.ok && sendResponse.result?.signature) {
      // Transaction successful!
      const signature = sendResponse.result.signature;

      // Show success screen
      transactionSignature.textContent = signature;
      linkViewExplorer.href = `https://explorer.solana.com/tx/${signature}`;

      showScreen(AppState.SEND_SUCCESS);

      // Send success event to agent
      sendEventToAgent('send_confirmed', {
        recipient,
        amount,
        asset: 'SOL',
        signature,
      });

      // Refresh balance
      await fetchBalance();
    } else {
      // Transaction failed
      const errorMsg = sendResponse.error?.message || "Transaction failed";
      amountError.textContent = errorMsg;
      amountError.classList.add("show");

      // Send failure event to agent
      sendEventToAgent('send_failed', {
        recipient,
        amount,
        asset: 'SOL',
        error: errorMsg,
      });
    }

  } catch (error: any) {
    console.error("Transaction error:", error);
    amountError.textContent = error.message || "Transaction failed";
    amountError.classList.add("show");

    // Send failure event to agent
    sendEventToAgent('send_failed', {
      recipient,
      amount,
      asset: 'SOL',
      error: error.message,
    });
  } finally {
    btnReviewTransaction.disabled = false;
    btnReviewTransaction.textContent = "Send";
  }
});

// Done button - return to main wallet
btnDoneSend.addEventListener("click", () => {
  showScreen(AppState.WALLET_MAIN);
});

// Click signature to view on explorer
transactionSignature.addEventListener("click", () => {
  if (linkViewExplorer.href) {
    chrome.tabs.create({ url: linkViewExplorer.href });
  }
});

// Approval: Connection buttons
btnApproveConnection.addEventListener("click", async () => {
  if (!pendingApprovalRequest) return;

  try {
    // Send approval response to background
    await chrome.runtime.sendMessage({
      channel: "my-little-wallet",
      id: pendingApprovalRequest.id,
      method: "approveConnection",
      params: { approved: true },
    });

    // Add to approved dapps with default daily limit
    const origin = pendingApprovalRequest.params?.origin;
    if (origin) {
      try {
        const url = new URL(origin);
        const storage = await chrome.storage.local.get(['approvedDapps']);
        const dapps: ApprovedDapp[] = storage.approvedDapps || [];

        // Check if not already approved
        const existing = dapps.find(d => d.origin === origin);
        if (!existing) {
          const today = new Date().toISOString().split('T')[0];

          // Calculate default limit in SOL based on 100 USD
          const solPrice = await fetchSOLPrice();
          const defaultLimitUSD = 100; // $100 USD default
          const defaultLimitSOL = solPrice > 0 ? defaultLimitUSD / solPrice : 1.0;

          const newDapp: ApprovedDapp = {
            origin,
            hostname: url.hostname,
            approvedAt: Date.now(),
            dailyLimit: defaultLimitSOL,
            dailyLimitUSD: defaultLimitUSD,
            spentToday: 0,
            lastResetDate: today,
          };
          dapps.push(newDapp);
          await chrome.storage.local.set({ approvedDapps: dapps });
          showToast(`${url.hostname} approved with $${defaultLimitUSD} daily limit`);
        }
      } catch (error) {
        console.error("Error adding approved dapp:", error);
      }
    }

    // Clear pending request and return to main wallet
    pendingApprovalRequest = null;
    showScreen(AppState.WALLET_MAIN);
    showToast("Connection approved ✓");
  } catch (error) {
    console.error("Error approving connection:", error);
    showToast("Failed to approve connection");
  }
});

btnRejectConnection.addEventListener("click", async () => {
  if (!pendingApprovalRequest) return;

  try {
    // Send rejection response to background
    await chrome.runtime.sendMessage({
      channel: "my-little-wallet",
      id: pendingApprovalRequest.id,
      method: "approveConnection",
      params: { approved: false },
    });

    // Clear pending request and return to main wallet
    pendingApprovalRequest = null;
    showScreen(AppState.WALLET_MAIN);
    showToast("Connection rejected");
  } catch (error) {
    console.error("Error rejecting connection:", error);
  }
});

// Approval: Transaction buttons
btnApproveTransaction.addEventListener("click", async () => {
  if (!pendingApprovalRequest) return;

  try {
    const origin = pendingApprovalRequest.params?.origin;
    const amount = pendingApprovalRequest.params?.amount || 0;

    // Check daily limit before approving
    if (origin && amount > 0) {
      const storage = await chrome.storage.local.get(['approvedDapps']);
      const dapps: ApprovedDapp[] = storage.approvedDapps || [];
      const dapp = dapps.find(d => d.origin === origin);

      if (dapp) {
        const today = new Date().toISOString().split('T')[0];

        // Reset if new day
        if (dapp.lastResetDate !== today) {
          dapp.spentToday = 0;
          dapp.lastResetDate = today;
        }

        // Check if transaction would exceed limit
        const newTotal = dapp.spentToday + amount;
        if (newTotal > dapp.dailyLimit) {
          const confirmed = confirm(
            `⚠️ Daily Limit Warning\n\n` +
            `This transaction would exceed the daily spending limit for ${dapp.hostname}.\n\n` +
            `Limit: ${dapp.dailyLimit} SOL\n` +
            `Already spent today: ${dapp.spentToday.toFixed(4)} SOL\n` +
            `This transaction: ${amount} SOL\n` +
            `New total: ${newTotal.toFixed(4)} SOL\n\n` +
            `Approve anyway?`
          );

          if (!confirmed) {
            pendingApprovalRequest = null;
            showScreen(AppState.WALLET_MAIN);
            showToast("Transaction cancelled");
            return;
          }
        }

        // Update spent amount
        dapp.spentToday = newTotal;
        await chrome.storage.local.set({ approvedDapps: dapps });
      }
    }

    // Send approval response to background
    await chrome.runtime.sendMessage({
      channel: "my-little-wallet",
      id: pendingApprovalRequest.id,
      method: "approveTransaction",
      params: { approved: true },
    });

    // Clear pending request and return to main wallet
    pendingApprovalRequest = null;
    showScreen(AppState.WALLET_MAIN);
    showToast("Transaction approved ✓");
  } catch (error) {
    console.error("Error approving transaction:", error);
    showToast("Failed to approve transaction");
  }
});

btnRejectTransaction.addEventListener("click", async () => {
  if (!pendingApprovalRequest) return;

  try {
    // Send rejection response to background
    await chrome.runtime.sendMessage({
      channel: "my-little-wallet",
      id: pendingApprovalRequest.id,
      method: "approveTransaction",
      params: { approved: false },
    });

    // Clear pending request and return to main wallet
    pendingApprovalRequest = null;
    showScreen(AppState.WALLET_MAIN);
    showToast("Transaction rejected");
  } catch (error) {
    console.error("Error rejecting transaction:", error);
  }
});

// Listen for approval requests from background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.channel !== "my-little-wallet") return;

  if (message.method === "requestConnectionApproval") {
    // Store the pending request
    pendingApprovalRequest = message;

    // Update UI with origin information
    const siteNameEl = document.getElementById("approval-site-name");
    const siteUrlEl = document.getElementById("approval-site-url");

    if (siteNameEl && message.params?.origin) {
      try {
        const url = new URL(message.params.origin);
        siteNameEl.textContent = url.hostname;
        if (siteUrlEl) siteUrlEl.textContent = message.params.origin;
      } catch (e) {
        siteNameEl.textContent = message.params.origin;
        if (siteUrlEl) siteUrlEl.textContent = message.params.origin;
      }
    }

    // Show approval screen
    showScreen(AppState.APPROVE_CONNECTION);
    sendResponse({ ok: true });
    return true;
  }

  if (message.method === "requestTransactionApproval") {
    // Store the pending request
    pendingApprovalRequest = message;

    // Update UI with transaction details
    const txOriginEl = document.getElementById("tx-origin");
    const txAmountEl = document.getElementById("tx-amount");
    const txToEl = document.getElementById("tx-to");
    const txFromEl = document.getElementById("tx-from");

    if (txOriginEl) txOriginEl.textContent = message.params?.origin || "Unknown";
    if (txAmountEl) txAmountEl.textContent = message.params?.amount ? `${message.params.amount} SOL` : "Unknown";
    if (txToEl) txToEl.textContent = message.params?.to || "Unknown";
    if (txFromEl) txFromEl.textContent = message.params?.from || publicKey || "Unknown";

    // Show approval screen
    showScreen(AppState.APPROVE_TRANSACTION);
    sendResponse({ ok: true });
    return true;
  }
});

// Links
document.getElementById("view-prompts")?.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({
    url: "https://github.com/BitHighlander/my-little-wallet/blob/master/PROMPTS.md",
  });
});

// Initialize app on startup
initializeApp();

// Expose helper function to console for testing
(window as any).addDapp = manuallyAddDapp;

// Auto-add honey.land on first load
async function initializeDefaultDapps() {
  try {
    const storage = await chrome.storage.local.get(['approvedDapps', 'defaultDappsAdded']);

    // Only add defaults once
    if (!storage.defaultDappsAdded) {
      await manuallyAddDapp('https://honey.land', 'honey.land', 100);
      await chrome.storage.local.set({ defaultDappsAdded: true });
      console.log('[Wallet] Default dapps initialized');
    }
  } catch (error) {
    console.error('[Wallet] Error initializing default dapps:', error);
  }
}

// Initialize default dapps
initializeDefaultDapps();
