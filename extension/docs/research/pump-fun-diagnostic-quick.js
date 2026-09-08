// Quick diagnostic for pump.fun wallet detection
// Run this in the console on pump.fun

console.group('🔍 Quick Wallet Detection Check');

// 1. Check window.solana
console.log('1. window.solana exists:', !!window.solana);
console.log('   isMyLittleWallet:', window.solana?.isMyLittleWallet);

// 2. Check navigator.wallets
console.log('2. navigator.wallets exists:', !!window.navigator?.wallets);
if (window.navigator?.wallets) {
  console.log('   wallets array:', window.navigator.wallets);
  console.log('   wallets length:', window.navigator.wallets.length);

  // Try to call each wallet getter
  window.navigator.wallets.forEach((getWallet, i) => {
    try {
      const wallet = getWallet();
      console.log(`   Wallet ${i}:`, wallet.name, wallet);
    } catch (e) {
      console.error(`   Wallet ${i} error:`, e);
    }
  });
}

// 3. Check global flag
console.log('3. _my_little_wallet_injected:', globalThis._my_little_wallet_injected);

// 4. Try to manually get the wallet from registry
console.log('4. Looking for My Little Wallet in registry...');
if (window.navigator?.wallets) {
  const myWallet = window.navigator.wallets.find((getWallet) => {
    try {
      const w = getWallet();
      return w.name === 'My Little Wallet';
    } catch {
      return false;
    }
  });

  if (myWallet) {
    console.log('   ✅ Found My Little Wallet!', myWallet());
  } else {
    console.log('   ❌ My Little Wallet not found in registry');
  }
}

// 5. Check if wallet-standard events are firing
console.log('5. Listening for wallet-standard events...');
let eventCount = 0;
window.addEventListener('wallet-standard:register-wallet', (e) => {
  eventCount++;
  console.log(`   Event ${eventCount}:`, e.detail);
});
console.log('   Event listener registered. Try reloading the page to see events.');

console.groupEnd();
