# Electrobun Research Report

> Date: 2026-03-12
> Task: Research Electrobun capabilities for meet-ai desktop app

## Overview

**Repo:** [blackboardsh/electrobun](https://github.com/blackboardsh/electrobun)
**License:** MIT | **Stars:** ~9,500 | **Open Issues:** 131
**Current Version:** v1.15.1 (released March 6, 2026)
**Created:** February 2024 | **Last pushed:** March 8, 2026 (very active)

Electrobun is a TypeScript-first desktop application framework — essentially **"Tauri but without Rust"**. You write TypeScript on both sides (main process + webview), and the native layer is abstracted away via Zig/C++/ObjC bindings loaded through Bun's FFI.

## Architecture (3 Layers)

| Layer | Tech | Role |
|-------|------|------|
| Main process | **Bun** | Backend logic, native APIs, window management |
| Native wrapper | C++ / ObjC / Zig | OS bindings via `bun:ffi` |
| Webview | System native (or optional CEF) | React UI renders here |

## How It Compares

### vs Electron

| Aspect | Electron | Electrobun |
|--------|----------|------------|
| Runtime | Node.js + Chromium | Bun + system webview (or optional CEF) |
| Bundle size | ~150MB uncompressed | ~12-14MB (system webview) |
| Update size | Up to 150MB (blockmap) | As small as 14KB (bsdiff patches) |
| IPC | `ipcMain`/`ipcRenderer` (string-based) | Typed RPC with schema (request/response + messages) |
| Webview embedding | Deprecated `<webview>` tag, or BrowserView | `<electrobun-webview>` (OOPIF with DOM positioning) |
| Language | JS/TS backend, HTML/CSS/JS frontend | TypeScript everywhere, native bindings in Zig/C++/ObjC |
| GPU support | Via Chromium | First-class WGPU (Dawn), Three.js, Babylon.js built-in |

### vs Tauri

| Aspect | Tauri | Electrobun |
|--------|-------|------------|
| Backend language | Rust | TypeScript (via Bun) |
| Learning curve | Must know Rust | Pure TypeScript |
| Webview | System webview only | System webview OR bundled CEF |
| IPC | Rust <-> JS bridge | Typed TypeScript RPC (both sides are TS) |
| Update mechanism | Built-in updater | Custom bsdiff-based differential updates (14KB patches) |
| GPU rendering | Not built-in | Native WGPU windows, `<electrobun-wgpu>` tag |

## Core Features (Out of the Box)

From source exports (`package/src/bun/index.ts`):

- **BrowserWindow** — create and manage application windows
- **BrowserView** — embed additional webviews within windows
- **GpuWindow** — native GPU rendering surface (no webview)
- **WGPUView** — GPU view embeddable within webview windows
- **Tray** — system tray icons and menus
- **ApplicationMenu** — native application menu bar
- **ContextMenu** — native right-click context menus
- **Updater** — built-in auto-update with bsdiff differential patches
- **GlobalShortcut** — system-wide keyboard shortcuts
- **Screen** — display/monitor information
- **Session** — cookie and storage partition management
- **Socket** — encrypted WebSocket RPC between main process and webviews
- **Utils** — clipboard, notifications, file dialogs, message boxes, open external, etc.
- **PATHS** — cross-platform OS directories (appData, cache, documents, downloads, etc.)
- **WGPU / webgpu** — WebGPU adapter with Three.js and Babylon.js built-in
- **BuildConfig** — runtime access to build configuration
- **RPC system** — typed request/response and message-based IPC with schema definitions

## Desktop-Only Capabilities (Impossible in CLI/Web)

### 1. System Tray — Always-Present Agent Hub

```ts
Tray({ title: "Meet AI", image: icon, menu: [...] })
```

A persistent tray icon showing agent activity, unread messages, team status. Click to open, right-click for quick actions. Supports: title, image (with template icon support on macOS), custom menus with submenus, click events, show/hide, getBounds.

### 2. Global Keyboard Shortcuts

```ts
GlobalShortcut.register("CommandOrControl+Shift+Space", callback)
```

Summon meet-ai from anywhere — even when the app is hidden. Think **Spotlight for agents**. Register hotkeys for: quick message, toggle listening, approve/deny plan reviews. Electron-compatible accelerator string format. Web has zero access to system-wide shortcuts.

### 3. Native Notifications

```ts
showNotification({ title: "Agent needs approval", body: "Plan review waiting", subtitle: "room: feature-auth" })
```

Real OS notifications that work even when the app is minimized/hidden. Agent asks a question? Desktop pops a native notification. Cross-platform with optional sound suppression. Web notifications are second-class citizens with permission gates.

### 4. Multi-Window Architecture

```ts
// Main dashboard window
const main = new BrowserWindow({ width: 1200, height: 800 })

// Floating agent activity overlay
const overlay = new BrowserWindow({
  width: 400, height: 300,
  alwaysOnTop: true,
  titleBarStyle: "hidden",
  transparent: true
})
```

Window management API:
- `setTitle`, `setPosition`, `setSize`, `setFrame`, `getFrame`
- `minimize`, `unminimize`, `maximize`, `unmaximize`
- `setFullScreen`, `isFullScreen`
- `setAlwaysOnTop`, `isAlwaysOnTop`
- `setVisibleOnAllWorkspaces`, `isVisibleOnAllWorkspaces`
- `focus`, `show`, `hide`
- `titleBarStyle`: "default", "hidden" (frameless), "hiddenInset" (transparent with inset controls)
- `transparent: true` for see-through windows
- Draggable regions for custom chrome
- `sandbox: true` for untrusted content (disables RPC)
- Navigation rules for URL filtering
- Multiple BrowserViews per window (OOPIF architecture)

**Use cases:** Floating overlay for agent activity, detachable chat rooms, picture-in-picture agent monitor. Web is trapped in a single tab.

### 5. Clipboard Integration

```ts
clipboardReadText() / clipboardWriteText(text)
clipboardReadImage() / clipboardWriteImage(pngData)  // PNG as Uint8Array
clipboardClear()
clipboardAvailableFormats()  // ["text", "image", "files", "html"]
```

Copy agent output directly to clipboard, paste images from clipboard into chat (screenshot sharing). Web clipboard API is heavily restricted and requires user gesture.

### 6. File System Access

```ts
openFileDialog({
  startingFolder,
  allowedFileTypes: [".md", ".ts"],
  canChooseFiles: true,
  canChooseDirectory: false,
  allowsMultipleSelection: true
})
showItemInFolder(path)
moveToTrash(path)
openPath(path)
```

Drag-and-drop files into agent conversations, browse and attach local files natively, open agent-generated files directly in Finder/Explorer. Web file access requires repeated user permission grants.

### 7. Auto-Updates (bsdiff — 14KB patches)

```ts
Updater.checkForUpdates()
```

Built-in `Updater` with custom bsdiff-based mechanism:
- Generates differential patches between versions (as small as 14KB)
- Uses zig-bsdiff (SIMD-optimized, zstd compressed)
- Granular status tracking (30+ status types: checking, downloading, applying, etc.)
- Supports patch chains (multiple sequential patches)
- Falls back to full bundle download if patches unavailable
- Configure via `release.baseUrl` in `electrobun.config.ts`

### 8. Deep Linking / Custom Protocol

```
meetai://room/abc123
meetai://approve/plan-review-id
```

`urlSchemes` in config registers custom URL schemes. Handle via `Electrobun.events.on("open-url", handler)`. Click a link anywhere on the system → opens meet-ai to that room/action. **macOS only currently**, Windows/Linux coming.

### 9. Native Menus

- **ApplicationMenu** — app menu bar with roles, accelerators, submenus
- **ContextMenu** — native right-click menus
- **Tray menus** — via `tray.setMenu(config)`
- All support: labels, actions, data payloads, enabled/disabled, checked state, hidden items, tooltips, dividers

Full native look and feel — not CSS-styled divs pretending to be menus.

### 10. WebGPU / GPU Windows

```ts
const gpuWindow = new GpuWindow({ width: 800, height: 600 })
// Or embed in webview:
<electrobun-wgpu />
```

- 3D visualizations of agent workflows
- GPU-accelerated data visualizations
- Ships with **Three.js and Babylon.js** adapters built-in
- Web WebGPU support is still spotty across browsers

### 11. Screen API

```ts
Screen.getPrimaryDisplay()   // bounds, workArea, scaleFactor
Screen.getAllDisplays()
Screen.getCursorScreenPoint()
```

Display bounds, work area, scale factor — useful for smart window positioning.

### 12. Session / Cookies

```ts
Session.fromPartition("persist:room-123")
session.cookies.get/set/remove/flush
```

Storage partitions for isolating data between contexts.

### 13. Typed RPC (IPC)

Custom typed RPC system (`createRPC`, `defineElectrobunRPC`):
- **Requests** — typed params and responses (like tRPC for desktop)
- **Messages** — fire-and-forget typed messages
- Transport: encrypted WebSocket between Bun and webview processes (AES-256-GCM, 500MB payload limit)
- Schema-driven: define your RPC schema as TypeScript types, get full type safety on both sides

Natural fit for the existing Hono-based architecture.

## Killer Feature Combos for Meet AI Desktop

| Feature Combo | What It Enables |
|---------------|----------------|
| **Tray + Global Shortcut** | `Cmd+Shift+Space` → instant agent command palette from anywhere |
| **Always-on-top overlay** | Floating transparent window showing live agent activity while you code |
| **Native notifications + Deep links** | "Agent needs approval" → click → opens directly to plan review |
| **Multi-window + Detach** | Pop a room into its own window, tile it alongside your editor |
| **Clipboard + File system** | Paste screenshots into chat, drag files to agents, one-click copy outputs |
| **Tray + Badge count** | Unread message count on tray icon — always know when agents need you |
| **Typed RPC** | Type-safe communication between main process and webviews — like tRPC for desktop |

## Version Gap

| | meet-ai repo | Latest |
|---|---|---|
| Version | **1.14.4** | **1.15.1** |
| Gap | 2 minor versions behind | Released March 6, 2026 |

Worth upgrading — active bugfixes and Windows stability improvements between these versions.

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| macOS | Most mature | Original platform, full feature support |
| Windows 11+ | Officially supported | Some rough edges (segfault on Alt+Tab, updater battery issues) |
| Ubuntu 22.04+ | Officially supported | Context menus unsupported, CEF rendering issues on Wayland |

## Limitations & Gotchas

| Limitation | Impact |
|---|---|
| **Deep linking macOS only** | Windows/Linux can't handle `meetai://` URLs yet |
| **No cross-compilation** | Must build on each target platform (use CI) |
| **Linux context menus unsupported** | Right-click menus won't work on Linux |
| **Windows still maturing** | Some segfault/updater issues on Windows |
| **No screen capture API** | Can't screenshot other apps (unlike Electron's `desktopCapturer`) |
| **No accessibility API** | Only what the webview provides natively |
| **Sandbox is all-or-nothing** | `sandbox: true` disables all RPC — no granular permissions |
| **CEF adds ~100MB** | System webview keeps it at 12MB, but CEF for consistency costs size |
| **Bun dependency** | Some npm packages with native addons may not be compatible |
| **No mobile support** | Desktop only (macOS, Windows, Linux) |
| **Community still growing** | 9.5K stars but small ecosystem of plugins/templates |
| **Docs are SPA-rendered** | Client-side rendered, not easily crawlable |
| **Code signing** | macOS signing/notarization built in; Windows signing not yet integrated |

## Build & Distribution

- **Bundle size:** ~12-14MB compressed (system webview); ~100MB+ with CEF
- **Update patches:** As small as 14KB using bsdiff
- **Runtime:** Bun (not Node.js)
- **Bundler:** Bun's built-in bundler (supports plugins, sourcemaps, minification)
- **Init:** `bunx electrobun init` scaffolds a project
- **Build targets:** "current", "all", or specific like "macos-arm64,win-x64"
- **Distribution:** Self-extracting archives with CLI-generated platform-specific artifacts
- **Build hooks:** preBuild, postBuild, postWrap, postPackage

### Platform-specific renderers

- **macOS**: WebKit (native) or CEF (optional)
- **Windows**: WebView2 (native) or CEF (optional)
- **Linux**: WebKitGTK (native) or CEF (recommended for advanced features)

## Conclusion

Electrobun gives meet-ai a **native-feeling agent dashboard** with capabilities fundamentally impossible in CLI or Web: system tray presence, global hotkeys, multi-window layouts, transparent overlays, native notifications, deep OS integration. The typed RPC system is a natural fit for the existing Hono-based architecture. At 12MB bundle size with 14KB updates, distribution is nearly painless.

**Most impactful quick wins:** tray icon + global shortcut + native notifications + floating overlay window. These four alone transform meet-ai from "a tab you visit" into "an always-present agent companion."
