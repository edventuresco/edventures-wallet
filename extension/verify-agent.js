/**
 * Verify AI Agent Integration Setup
 * Run with: node verify-agent.js
 */

require('dotenv').config();

console.log('🔍 Verifying AI Agent Integration Setup\n');
console.log('='.repeat(50));

// Check environment variables
const checks = {
  openai: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  elevenLabs: process.env.VITE_ELEVENLABS_API_KEY,
  model: process.env.VITE_OPENAI_MODEL || 'gpt-4-turbo-preview',
};

console.log('\n📋 Configuration Status:\n');

if (checks.openai) {
  console.log('✅ OpenAI API Key: ' + checks.openai.substring(0, 15) + '...');
} else {
  console.log('❌ OpenAI API Key: NOT CONFIGURED');
  console.log('   → Add VITE_OPENAI_API_KEY to .env file');
}

if (checks.elevenLabs) {
  console.log('✅ ElevenLabs API Key: ' + checks.elevenLabs.substring(0, 15) + '...');
} else {
  console.log('⚠️  ElevenLabs API Key: NOT CONFIGURED');
  console.log('   → Voice features will not work');
}

console.log('✅ OpenAI Model: ' + checks.model);

// Check built files
const fs = require('fs');
const distExists = fs.existsSync('./dist/background.js');
const manifestExists = fs.existsSync('./dist/manifest.json');

console.log('\n📦 Build Status:\n');
console.log(distExists ? '✅ background.js built' : '❌ background.js missing - run npm run build');
console.log(manifestExists ? '✅ manifest.json present' : '❌ manifest.json missing');

// Check for new agent files in dist
const agentFiles = [
  './src/services/openai-service.ts',
  './src/services/agent-coordinator.ts',
  './src/services/function-registry.ts',
  './src/services/context-manager.ts',
  './src/services/security-validator.ts',
];

console.log('\n🔧 Agent Service Files:\n');
agentFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(exists ? '✅ ' + file : '❌ ' + file);
});

// Final verdict
console.log('\n' + '='.repeat(50));

const allGood = checks.openai && distExists && manifestExists;

if (allGood) {
  console.log('\n🎉 Setup Complete! Ready to test.\n');
  console.log('📝 Next Steps:\n');
  console.log('1. Open Chrome and go to: chrome://extensions/');
  console.log('2. Enable "Developer mode" (top right toggle)');
  console.log('3. Click "Load unpacked"');
  console.log('4. Select this project\'s dist/ folder');
  console.log('5. Open the extension and try voice commands:\n');
  console.log('   • "How much SOL do I have?"');
  console.log('   • "Show me my balance"');
  console.log('   • "What\'s my wallet address?"');
  console.log('   • "Check my token balances"\n');
} else {
  console.log('\n⚠️  Issues detected - please fix the above errors.\n');
  if (!checks.openai) {
    console.log('💡 Tip: Add VITE_OPENAI_API_KEY to your .env file');
  }
  if (!distExists) {
    console.log('💡 Tip: Run "npm run build" to build the extension');
  }
}

console.log('='.repeat(50) + '\n');
