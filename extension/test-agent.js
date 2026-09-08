/**
 * Quick test script for AI Agent integration
 * Run with: node test-agent.js
 */

require('dotenv').config();

// Mock chrome.storage for testing
global.chrome = {
  storage: {
    local: {
      data: {},
      async get(key) {
        return { [key]: this.data[key] };
      },
      async set(obj) {
        Object.assign(this.data, obj);
      },
    },
  },
};

async function testAgent() {
  console.log('🧪 Testing AI Agent Integration...\n');

  // Check environment
  const apiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('❌ Error: OPENAI_API_KEY not found in .env');
    console.log('Please add your OpenAI API key to .env file');
    process.exit(1);
  }

  console.log('✅ OpenAI API key found:', apiKey.substring(0, 10) + '...');

  try {
    // Import and test modules
    console.log('\n📦 Loading modules...');

    const { contextManager } = require('./dist/background.js');
    console.log('✅ Context Manager loaded');

    // Test context manager
    console.log('\n🧪 Testing Context Manager...');
    await contextManager.init();
    await contextManager.saveMessage('user', 'Hello, how are you?');
    await contextManager.saveMessage('assistant', 'I am doing great! How can I help you today?');

    const history = await contextManager.getHistory();
    console.log('✅ Messages saved and retrieved:', history.length, 'messages');

    const sessionInfo = contextManager.getSessionInfo();
    console.log('✅ Session ID:', sessionInfo.sessionId);

    console.log('\n✨ All tests passed!\n');
    console.log('📝 Next steps:');
    console.log('   1. Load extension in Chrome (chrome://extensions/)');
    console.log('   2. Enable Developer mode');
    console.log('   3. Click "Load unpacked" and select the dist/ folder');
    console.log('   4. Open the wallet and try voice commands!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
testAgent().catch(console.error);
