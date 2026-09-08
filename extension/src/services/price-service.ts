/**
 * Price Service
 *
 * Fetches cryptocurrency prices from CoinGecko API
 */

interface PriceCache {
  price: number;
  timestamp: number;
}

const CACHE_DURATION = 60000; // 1 minute cache
const priceCache = new Map<string, PriceCache>();

/**
 * Fetch SOL price in USD from CoinGecko
 */
export async function fetchSOLPrice(): Promise<number> {
  const cacheKey = 'solana-usd';
  const cached = priceCache.get(cacheKey);

  // Return cached price if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price;
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const price = data?.solana?.usd;

    if (typeof price !== 'number') {
      throw new Error('Invalid price data from CoinGecko');
    }

    // Cache the price
    priceCache.set(cacheKey, {
      price,
      timestamp: Date.now(),
    });

    return price;
  } catch (error) {
    console.error('[PriceService] Failed to fetch SOL price:', error);

    // Return cached price even if expired, or fallback to 0
    if (cached) {
      console.warn('[PriceService] Using stale price cache');
      return cached.price;
    }

    return 0; // Fallback to 0 if no cache available
  }
}

/**
 * Format balance with USD value
 */
export function formatBalanceWithUSD(
  solBalance: number,
  solPrice: number
): {
  sol: string;
  usd: string;
  solValue: number;
  usdValue: number;
} {
  const usdValue = solBalance * solPrice;

  return {
    sol: solBalance.toFixed(2),
    usd: usdValue.toFixed(2),
    solValue: solBalance,
    usdValue,
  };
}
