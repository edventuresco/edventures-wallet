# Plasmo Framework Research

**Date:** 2026-01-24
**Purpose:** Evaluate Plasmo as potential replacement for custom Vite build setup

---

## Executive Summary

**Plasmo** is a batteries-included browser extension framework that abstracts away build configuration through a declarative, file-based approach. Think "Next.js for browser extensions."

**Key Value Proposition:**
- Zero-config builds with automatic manifest generation
- First-class TypeScript + React support with HMR
- Cross-browser targeting from single codebase
- Built-in storage/messaging abstractions
- Shadow DOM-based content script UI injection

**Status:** Alpha software (use at own risk, API may change)

---

## 1. Key Features & Capabilities

### Core Philosophy
- **Declarative Development**: Write a file, export a component → Plasmo handles bundling and mounting
- **Convention Over Configuration**: File-system routing (`popup.tsx` → popup UI, `background.ts` → service worker)
- **Battery-Packed**: Includes storage, messaging, env vars, and deployment tools out-of-the-box

### Framework Highlights
- **Automatic Manifest Generation**: Abstracts away manifest.json, generates it from source files
- **Live Reload + HMR**: React Hot Module Replacement during development
- **Content Script UI (CSUI)**: Shadow DOM isolation for injecting React/Vue/Svelte into webpages
- **Multi-Browser Builds**: Target Chrome/Firefox/Edge/Safari from single source
- **Type Safety**: Auto-generated TypeScript types for message handlers
- **Built-in APIs**: Storage sync, messaging relay, environment variables

---

## 2. Build System & Bundling

### Architecture
- **Bundler**: Parcel (underlying engine)
- **Approach**: Opinionated with escape hatches for customization
- **Output**: `build/<browser>-<manifest>-<mode>/` (e.g., `build/chrome-mv3-dev/`)

### Build Commands
```bash
pnpm dev                    # Development mode with live reload
pnpm build                  # Production build
pnpm build --zip            # Production + zip for store submission
pnpm build --target=firefox-mv2  # Target specific browser/manifest
pnpm build --tag=staging    # Custom build variant
```

### Build Features
- **Dead Code Elimination**: `process.env.PLASMO_BROWSER` enables conditional logic
- **Target-Specific Files**: `popup.firefox.tsx` for browser variants
- **Environment Files**: `.env.<browser>`, `.env.<tag>` cascading config
- **Source Maps**: `--source-maps` flag
- **Bundle Analysis**: `--bundle-buddy` with source maps
- **Dependency Hoisting**: `--hoist` for deduplication (may conflict with plugins)

### Output Organization
```
build/
├── chrome-mv3-dev/        # Development build
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   └── manifest.json      # Auto-generated
└── chrome-mv3-prod/       # Production build
```

---

## 3. Hot Reload & Development Experience

### Developer Workflow
```bash
pnpm create plasmo my-extension
cd my-extension
pnpm dev
# Manual: Load unpacked from build/chrome-mv3-dev in chrome://extensions
```

### Development Features
- **Live Reload**: Automatic browser refresh on file changes
- **React HMR**: Component updates without full reload
- **Dev Indicators**: Extension prefixed with "DEV |", grayscale icon
- **Server Customization**: `--serve-port`, `--hmr-port` flags
- **Source Maps**: Enabled by default (disable with `--no-source-maps`)

### Limitations
- Manual extension loading required (no auto-load automation yet)
- Must enable Developer Mode in browser manually

---

## 4. Framework Support

### First-Class Support
- **React** + TypeScript (primary, best DX)
- **Preact**
- **Svelte**
- **Vue**

### Implementation
- Default templates use React + TypeScript
- Optional community templates for Svelte/Vue:
  - `pnpm create plasmo --template with-svelte`
  - `pnpm create plasmo --template with-vue`

### Component Export Pattern
```tsx
// popup.tsx
export default function Popup() {
  return <div>My Popup</div>
}
```

---

## 5. TypeScript Support

### Built-In Support
- **Configuration**: TypeScript enabled by default in templates
- **Types**: Auto-generated types for message handlers during compilation
- **Browser APIs**: `@types/chrome` for extension APIs
- **IntelliSense**: Full IDE support with type safety

### Type Safety Features
- Generic support for request/response bodies in messaging
- Static type generation for message handlers
- End-to-end type safety across extension components

---

## 6. Multi-Browser Support

### Supported Browsers
- Chrome (primary)
- Firefox
- Edge
- Safari (mentioned but less documented)

### Cross-Browser Workflow
```bash
# Build for specific browser
plasmo build --target=firefox-mv2
plasmo build --target=chrome-mv3

# Browser-specific environment
.env.firefox    # Firefox-only config
.env.chrome     # Chrome-only config

# Browser-specific code
popup.firefox.tsx  # Firefox-only popup
```

### Automatic Vendor Handling
- Dead code elimination via `process.env.PLASMO_BROWSER`
- Conditional logic for browser-specific features
- Automatic API compatibility handling for official targets

---

## 7. Manifest v2/v3 Support

### Default
- **Manifest V3** (MV3) is the default and primary target
- Build outputs: `chrome-mv3-dev`, `chrome-mv3-prod`

### MV2 Support
- Available via `--target=firefox-mv2` flag
- Migration tools: "MV2 to MV3" section in Itero platform

### Multi-Manifest Targeting
```bash
plasmo build --target=chrome-mv3
plasmo build --target=firefox-mv2
```

---

## 8. Common Use Cases & When Plasmo Excels

### Ideal Scenarios
1. **New Extension Projects**: Zero-config rapid prototyping
2. **React-Based Extensions**: First-class React + TypeScript DX
3. **Content Script UI**: Shadow DOM components injected into webpages
4. **Multi-Browser Distribution**: Single codebase targeting multiple browsers
5. **Cross-Component Communication**: Storage sync and messaging abstractions

### Where Plasmo Shines
- Eliminating build configuration boilerplate
- Automatic manifest generation
- Hot reload during development
- Type-safe messaging between extension components
- Content script UI with style isolation

### Example Projects
- Popup-based wallets (like your Solana wallet)
- Content enhancement extensions (overlays, annotations)
- Developer tools (debuggers, inspectors)
- Page modification extensions (ad blockers, productivity tools)

---

## 9. Migration Path from Existing Setups

### Current Setup (Vite-Based)
Your project uses:
- Vite bundler with manual rollup config
- Manual manifest.json management
- Custom entry point configuration
- Manual IIFE format specification
- Custom file naming logic

### Migration Steps (Estimated)

#### Step 1: Initialize Plasmo
```bash
pnpm create plasmo my-little-wallet-plasmo
cd my-little-wallet-plasmo
```

#### Step 2: Port Source Files
```
src/
├── background/index.ts     → background.ts or background/index.ts
├── content/bridge.ts       → content.ts
├── injected/provider.ts    → content.ts (inline injection) or static/injected-provider.js
├── popup/
│   ├── popup.tsx          → popup.tsx
│   └── popup.html         → Auto-generated (or override)
└── shared/                → shared/ (as-is)
```

#### Step 3: Adapt to Plasmo Conventions
- **Background**: Export default or named handlers (Plasmo handles service worker setup)
- **Popup**: Export default React component
- **Content Scripts**: Export config object + component for CSUI
- **Injected Provider**: Use `web_accessible_resources` or Plasmo's remote code feature

#### Step 4: Configure Environment
```bash
# .env
PLASMO_PUBLIC_RPC_ENDPOINT=https://...
```

#### Step 5: Remove Build Config
- Delete `vite.config.ts`
- Remove manual manifest.json (Plasmo generates it)
- Optional: Add manifest overrides via `package.json` or `plasmo.config.js`

#### Step 6: Update Package.json
```json
{
  "scripts": {
    "dev": "plasmo dev",
    "build": "plasmo build",
    "package": "plasmo build --zip"
  }
}
```

### Migration Considerations
- **Custom Manifest Fields**: Use manifest override feature
- **Build Output Paths**: Plasmo uses fixed structure (`build/`)
- **Injected Scripts**: May need static files or CSUI approach
- **Environment Variables**: Prefix with `PLASMO_PUBLIC_`

### Estimated Effort
- **Small Project** (like yours): 2-4 hours
- **Medium Project**: 1-2 days
- **Large Project**: 3-5 days

---

## 10. Known Limitations & Drawbacks

### Critical Issues (from GitHub)

#### 1. Build & Module Resolution
- **Parcel Integration**: "Failed to resolve module" errors requiring manual `.parcelrc` config
- **Dependency Issues**: `@parcel/watcher` version incompatibility
- **Workaround**: Manual Parcel configuration or dependency pinning

#### 2. Messaging System Breakage
- **Chrome 144+ Breaking Change**: Plasmo messaging completely broken in recent Chrome versions
- **Root Cause**: Connection establishment failures between content scripts and background
- **Status**: Critical blocker for production use until fixed

#### 3. Build Output Issues
- **Deprecated Fields**: `redirectUrl` persisting in production builds
- **Build Size**: Excessive sizes (61 MB reported in dev environments)
- **Manifest Validation**: Failures with certain JSON configurations

#### 4. Development Workflow
- **Hot Reload Failures**: `ERR_FILE_NOT_FOUND` errors
- **Dev Mode Broken**: Complete non-functionality in some setups
- **Content Scripts**: Nested content scripts not packaging correctly

#### 5. Cross-Browser Compatibility
- **Firefox**: `chrome.scripting.registerContentScripts` doesn't return promises
- **Mobile**: Foldable phone rendering issues

### Architectural Limitations
- **Alpha Software**: API stability not guaranteed, breaking changes expected
- **Parcel Dependency**: Locked into Parcel ecosystem (no webpack/esbuild option)
- **Opinionated**: Escape hatches exist but fighting conventions is painful
- **Manual Loading**: No automatic extension reload in browser

### Production Readiness Concerns
1. **Critical Bug**: Chrome 144+ messaging breakage (show-stopper)
2. **Stability**: Alpha status = production risk
3. **Debugging**: Abstraction layers complicate debugging when things break
4. **Community Size**: ~400 developers (small community for support)

---

## 11. Additional Capabilities

### Storage API (`@plasmohq/storage`)
- **Purpose**: Unified storage across extension contexts
- **Features**: Auto-JSON serialization, sync storage, localStorage fallback
- **Watch Mechanism**: Real-time storage change callbacks
- **React Hook**: `useStorage` for reactive state
- **Secure Storage**: Encrypted storage via Web Crypto API

```tsx
import { useStorage } from "@plasmohq/storage/hook"

function Popup() {
  const [name, setName] = useStorage("name", "")
  return <input value={name} onChange={e => setName(e.target.value)} />
}
```

### Messaging API (`@plasmohq/messaging`)
- **Purpose**: Type-safe, promise-based communication
- **Patterns**: Message flow, relay flow, ports (long-lived connections)
- **File-Based**: Add handler to `messages/` directory
- **Type Safety**: Auto-generated types with generics support

```ts
// messages/get-balance.ts
export default async function handler(req, res) {
  const balance = await fetchBalance(req.body.address)
  res.send({ balance })
}
```

### Environment Variables
- **Prefix**: `PLASMO_PUBLIC_` for exposed vars
- **Cascading**: `.env` → `.env.<browser>` → `.env.<tag>` → `.env.local`
- **Built-in Vars**: `PLASMO_BROWSER`, `PLASMO_TARGET`, `NODE_ENV`

### Deployment Tools
- **BPP (Browser Platform Publisher)**: Automated store submissions to Chrome/Firefox/Edge
- **Itero TestBed**: Real-world testing platform

---

## 12. Comparison to Current Setup

### Current Vite Setup
**Pros:**
- Full control over build process
- Explicit configuration (no magic)
- Stable, production-ready tooling
- Debugging is straightforward

**Cons:**
- Manual manifest management
- Custom rollup config maintenance
- No built-in HMR for extensions
- Manual multi-browser targeting
- Boilerplate for storage/messaging

### Plasmo Setup
**Pros:**
- Zero build configuration
- Automatic manifest generation
- HMR out-of-the-box
- Built-in storage/messaging abstractions
- Type-safe messaging
- Multi-browser targeting simplified
- Shadow DOM CSUI for content scripts

**Cons:**
- Alpha software (stability risk)
- Critical Chrome 144+ messaging bug
- Less control over build output
- Parcel dependency lock-in
- Smaller community (support)
- Debugging abstraction layers

---

## 13. Recommendation for Your Project

### Current State Analysis
Your Solana wallet extension:
- Manual Vite configuration (50 lines)
- React + TypeScript
- Background service worker
- Content script bridge
- Injected provider script
- Popup UI

### Should You Migrate to Plasmo?

#### ✅ **Arguments FOR Migration**
1. **Development Speed**: HMR would significantly improve iteration speed
2. **Reduced Boilerplate**: Eliminate vite.config.ts and manual manifest management
3. **Storage/Messaging**: Built-in abstractions could simplify wallet state management
4. **Type Safety**: Auto-generated types for message handlers
5. **Multi-Browser**: Easier to support Firefox/Edge in future

#### ❌ **Arguments AGAINST Migration**
1. **Critical Bug**: Chrome 144+ messaging breakage is a show-stopper for production
2. **Stability Risk**: Alpha software for a wallet (financial software) is high-risk
3. **Working Setup**: Current Vite setup works reliably
4. **Learning Curve**: Time investment to learn Plasmo conventions
5. **Debugging Complexity**: Abstraction layers harder to debug when issues arise

### **Final Recommendation: WAIT**

**Verdict:** Do NOT migrate to Plasmo at this time.

**Reasoning:**
1. **Critical Blocker**: The Chrome 144+ messaging bug makes Plasmo unsuitable for production wallets
2. **Financial Risk**: Wallet extensions handle private keys; alpha software is unacceptable
3. **Current Stability**: Your Vite setup is stable and working
4. **ROI**: Benefits (HMR, less boilerplate) don't justify risks (bugs, alpha status)

**Alternative Path:**
1. **Monitor Plasmo**: Watch for 1.0 stable release and bug fixes
2. **Optimize Current Setup**: Add HMR to Vite setup with `vite-plugin-web-extension`
3. **Incremental Adoption**: Test Plasmo on a non-critical side project first
4. **Reevaluate Q3 2026**: Check if Plasmo reaches beta/stable and community grows

---

## 14. Resources

### Documentation
- **Official Docs**: https://docs.plasmo.com/
- **GitHub Repo**: https://github.com/PlasmoHQ/plasmo
- **Examples**: https://github.com/PlasmoHQ/examples

### Key Docs Pages
- Framework: https://docs.plasmo.com/framework
- Build: https://docs.plasmo.com/framework/workflows/build
- Dev: https://docs.plasmo.com/framework/workflows/dev
- Storage: https://docs.plasmo.com/framework/storage
- Messaging: https://docs.plasmo.com/framework/messaging
- CSUI: https://docs.plasmo.com/framework/content-scripts-ui
- Customization: https://docs.plasmo.com/framework/customization

### Community
- Discord: https://www.plasmo.com/s/d (400+ developers)
- GitHub Issues: https://github.com/PlasmoHQ/plasmo/issues

---

## 15. Technical Deep Dive: How Plasmo Works

### File-Based Routing
Plasmo scans your project for special files and auto-generates manifest entries:

```
popup.tsx        → "action": {"default_popup": "popup.html"}
options.tsx      → "options_page": "options.html"
background.ts    → "background": {"service_worker": "background.js"}
content.ts       → "content_scripts": [...]
contents/*.tsx   → Multiple content scripts
```

### Content Script UI (CSUI) Architecture
1. Developer exports React/Vue/Svelte component in `content.tsx`
2. Plasmo creates Shadow DOM root at injection point
3. Component mounts inside Shadow DOM (style isolation)
4. Configuration via exported `config` object (matches, run_at, etc.)

```tsx
// content.tsx
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://github.com/*"],
  run_at: "document_end"
}

export default function ContentUI() {
  return <div>Injected into GitHub!</div>
}
```

### Messaging System Architecture
1. Add handler file: `messages/get-data.ts`
2. Plasmo auto-registers handler in background
3. Call from popup/content: `sendToBackground({name: "get-data"})`
4. Type generation during compilation

### Build Process
1. **File Discovery**: Scan for popup/background/content files
2. **Manifest Generation**: Create manifest.json from discovered files + overrides
3. **Bundling**: Parcel bundles each entry point
4. **Output Organization**: Place in `build/<target>/`
5. **Asset Copying**: Copy icons, locales, static files

---

## Appendix A: Migration Checklist (If Proceeding)

- [ ] Backup current working setup
- [ ] Create new Plasmo project: `pnpm create plasmo`
- [ ] Port background service worker to `background.ts`
- [ ] Port popup to `popup.tsx` (default export component)
- [ ] Port content script to `content.ts`
- [ ] Handle injected provider (static or CSUI)
- [ ] Configure environment variables (prefix with `PLASMO_PUBLIC_`)
- [ ] Test manifest generation (compare to current manifest.json)
- [ ] Add manifest overrides if needed
- [ ] Test storage functionality with `@plasmohq/storage`
- [ ] Test messaging with `@plasmohq/messaging`
- [ ] Verify hot reload works
- [ ] Test production build: `pnpm build`
- [ ] Load unpacked extension and test all features
- [ ] Test on multiple Chrome versions (especially 144+)
- [ ] Verify private key handling security
- [ ] Performance comparison (build time, bundle size)
- [ ] Document any Plasmo-specific quirks for team

---

## Appendix B: Alternative Solutions

If Plasmo doesn't fit, consider:

1. **vite-plugin-web-extension**
   - Adds HMR to Vite setup
   - Less intrusive than Plasmo
   - Keep current architecture

2. **WXT**
   - Similar to Plasmo but Vite-based
   - More control, less magic
   - https://wxt.dev/

3. **Extension.js**
   - Zero-config like Plasmo
   - Different architecture
   - https://extension.js.org/

4. **Stick with Vite**
   - Add incremental improvements
   - Proven stability
   - Full control

---

**Last Updated:** 2026-01-24
**Researcher:** Claude (Sonnet 4.5)
**Status:** Research Complete
