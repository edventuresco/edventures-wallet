/**
 * Approval System
 *
 * Manages user approval requests for connections and transactions.
 * Communicates with extension popup for user approval.
 */

interface PendingRequest {
  requestId: string;
  type: 'connection' | 'transaction';
  origin: string;
  data?: any;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeoutId?: NodeJS.Timeout;
}

// Store pending approval requests
const pendingRequests = new Map<string, PendingRequest>();

/**
 * Request user approval for a connection
 */
export async function requestConnectionApproval(origin: string): Promise<boolean> {
  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    // Timeout after 2 minutes
    const timeoutId = setTimeout(() => {
      const request = pendingRequests.get(requestId);
      if (request) {
        request.reject(new Error('Approval request timed out'));
        pendingRequests.delete(requestId);
      }
    }, 120000);

    // Store pending request
    pendingRequests.set(requestId, {
      requestId,
      type: 'connection',
      origin,
      resolve,
      reject,
      timeoutId,
    });

    // Open the extension popup to show approval screen
    chrome.action.openPopup().catch((error) => {
      console.warn('[Approvals] Could not open popup programmatically:', error);
      // This is expected in some contexts - user will need to click the extension icon
    });

    console.log('[Approvals] Connection approval request pending:', requestId);
  });
}

/**
 * Request user approval for a transaction
 */
export async function requestTransactionApproval(
  origin: string,
  txData: any
): Promise<boolean> {
  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    // Timeout after 2 minutes
    const timeoutId = setTimeout(() => {
      const request = pendingRequests.get(requestId);
      if (request) {
        request.reject(new Error('Approval request timed out'));
        pendingRequests.delete(requestId);
      }
    }, 120000);

    // Store pending request
    pendingRequests.set(requestId, {
      requestId,
      type: 'transaction',
      origin,
      data: txData,
      resolve,
      reject,
      timeoutId,
    });

    // Open the extension popup to show approval screen
    chrome.action.openPopup().catch((error) => {
      console.warn('[Approvals] Could not open popup programmatically:', error);
      // This is expected in some contexts - user will need to click the extension icon
    });

    console.log('[Approvals] Transaction approval request pending:', requestId);
  });
}

/**
 * Handle approval response from popup
 */
export function handleApprovalResponse(requestId: string, approved: boolean): void {
  const request = pendingRequests.get(requestId);

  if (!request) {
    console.warn('[Approvals] No pending request found for:', requestId);
    return;
  }

  // Clear timeout
  if (request.timeoutId) {
    clearTimeout(request.timeoutId);
  }

  // Resolve or reject the promise
  if (approved) {
    request.resolve(true);
  } else {
    request.reject(new Error('User rejected the request'));
  }

  // Clean up
  pendingRequests.delete(requestId);
}

/**
 * Get pending approval request (for popup to retrieve)
 */
export function getPendingApproval(): {
  requestId: string;
  type: 'connection' | 'transaction';
  origin: string;
  data?: any;
} | null {
  // Get the first pending request
  const firstEntry = pendingRequests.entries().next();

  if (firstEntry.done) {
    return null;
  }

  const [requestId, request] = firstEntry.value;

  return {
    requestId,
    type: request.type,
    origin: request.origin,
    data: request.data,
  };
}

/**
 * Cancel all pending requests (e.g., on extension shutdown)
 */
export function cancelAllPendingRequests(): void {
  for (const [_requestId, request] of pendingRequests.entries()) {
    // Clear timeout
    if (request.timeoutId) {
      clearTimeout(request.timeoutId);
    }

    request.reject(new Error('Extension shutdown'));
  }

  pendingRequests.clear();
}
