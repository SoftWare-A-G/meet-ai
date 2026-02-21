# File System Access API — Research Report

**Date:** 2026-02-21
**Author:** fs-access-researcher agent

---

## Table of Contents

1. [API Overview](#api-overview)
2. [What Can We Build](#what-can-we-build)
3. [Core API Surface](#core-api-surface)
4. [Browser Support](#browser-support)
5. [Libraries & Wrappers](#libraries--wrappers)
6. [React Hooks](#react-hooks)
7. [API Complexity Assessment](#api-complexity-assessment)
8. [Permission Model & Persistence](#permission-model--persistence)
9. [File Watching (FileSystemObserver)](#file-watching-filesystemobserver)
10. [Real-World Implementations](#real-world-implementations)
11. [Limitations & Gotchas](#limitations--gotchas)
12. [Recommendation](#recommendation)

---

## API Overview

The **File System Access API** (WICG spec, not a W3C standard) exposes the user's local file system to web applications. It extends the older File API with the ability to write files, access directories, and maintain file handles across operations. The API lives under `window.showOpenFilePicker()`, `window.showSaveFilePicker()`, and `window.showDirectoryPicker()`.

Key distinction: There are actually **two related APIs**:

| API | Scope | Browser Support |
|-----|-------|----------------|
| **File System Access API** | User's real file system (picker-based) | Chromium only |
| **Origin Private File System (OPFS)** | Sandboxed, origin-isolated storage | Chrome, Firefox, Safari |

Mozilla has officially classified the File System Access API (the picker-based one) as **"harmful"** in their standards-positions repo, citing security risks around arbitrary file access, cross-origin file sharing, and inadequate protections. They support OPFS but not the full spec.

---

## What Can We Build

### Feasible with the File System Access API

| Feature | Feasibility | Notes |
|---------|------------|-------|
| **File browser / tree view** | High | `showDirectoryPicker()` + recursive iteration |
| **In-browser code/text editor with save-to-disk** | High | This is literally the primary use case (vscode.dev does this) |
| **Drag-and-drop file references** | High | `DataTransferItem.getAsFileSystemHandle()` supported |
| **Watching for file changes** | Medium | `FileSystemObserver` exists but experimental/non-standard |
| **Diffing local files** | High | Read two files, diff in JS — straightforward |
| **Markdown preview of local files** | High | Read file, render with markdown library |
| **Project-wide search across local files** | Medium | Possible but slow for large directories (no native search) |
| **Sharing file contents with AI agents** | High | Read file contents, send to API |

### Not feasible

- **Accessing files without user interaction** — Always requires a picker or prior handle
- **Background file system monitoring** — No service worker integration
- **Working on mobile browsers** — Zero support on iOS/Android
- **Cross-browser support** — Firefox actively opposes the spec

---

## Core API Surface

### Opening Files

```js
// Open file picker — returns array of FileSystemFileHandle
const [fileHandle] = await window.showOpenFilePicker({
  types: [{ description: 'Text', accept: { 'text/plain': ['.txt', '.md'] } }],
  multiple: false,
});

// Read file contents
const file = await fileHandle.getFile();
const text = await file.text();
// or: const buffer = await file.arrayBuffer();
// or: const stream = file.stream();
```

### Saving Files

```js
// Save to existing handle (overwrite)
const writable = await fileHandle.createWritable();
await writable.write(contents);
await writable.close();

// Save as new file
const newHandle = await window.showSaveFilePicker({
  suggestedName: 'untitled.md',
  types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
});
const writable = await newHandle.createWritable();
await writable.write(contents);
await writable.close();
```

### Opening Directories

```js
const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

// Iterate entries (shallow)
for await (const [name, handle] of dirHandle.entries()) {
  console.log(handle.kind, name); // "file" or "directory"
}

// Recursive tree walk
async function* getFilesRecursively(dirHandle, path = '') {
  for await (const [name, handle] of dirHandle.entries()) {
    const fullPath = path ? `${path}/${name}` : name;
    if (handle.kind === 'file') {
      yield { path: fullPath, handle };
    } else {
      yield* getFilesRecursively(handle, fullPath);
    }
  }
}

for await (const { path, handle } of getFilesRecursively(dirHandle)) {
  console.log(path);
}
```

### Drag and Drop Integration

```js
elem.addEventListener('drop', async (e) => {
  e.preventDefault();
  for (const item of e.dataTransfer.items) {
    const handle = await item.getAsFileSystemHandle();
    if (handle.kind === 'file') {
      const file = await handle.getFile();
      console.log(file.name, await file.text());
    }
  }
});
```

---

## Browser Support

### Desktop

| Browser | Support | Version | Notes |
|---------|---------|---------|-------|
| **Chrome** | Full | 86+ (full at 105+) | Primary implementer |
| **Edge** | Full | 86+ (full at 105+) | Chromium-based |
| **Opera** | Full | 72+ (full at 91+) | Chromium-based |
| **Brave** | Partial | Behind flag | Requires enabling |
| **Firefox** | None | N/A | Officially "harmful" position |
| **Safari** | None | N/A | No implementation plans |

### Mobile

**No support on any mobile browser** — iOS Safari, Chrome Android, Samsung Internet, Firefox Android, Opera Mobile — all unsupported.

### Global Coverage

~34% of global browser usage (Chromium desktop only).

---

## Libraries & Wrappers

### 1. browser-fs-access (GoogleChromeLabs)

- **npm**: `browser-fs-access`
- **Stars**: 1,600+
- **Weekly downloads**: ~161,000
- **Bundle size**: ~43 kB
- **License**: Apache 2.0
- **Used by**: Excalidraw, SVGcode

**What it does**: Ponyfill that uses native API when available, falls back to `<input type="file">` and `<a download>` on unsupported browsers. Three methods: `fileOpen()`, `directoryOpen()`, `fileSave()`.

**When to use**: When you need cross-browser file open/save with automatic fallback. Good for simple file I/O scenarios.

**When NOT to use**: When you need directory handles, file watching, or persistent handles — it abstracts those away.

```js
import { fileOpen, fileSave, supported } from 'browser-fs-access';

const blob = await fileOpen({ mimeTypes: ['text/*'] });
await fileSave(blob, { fileName: 'output.txt' });
```

### 2. file-system-access (Ponyfill)

- **npm**: `file-system-access`
- **Stars**: 27
- **Last update**: March 2023 (stale)
- **License**: MIT

**What it does**: Full spec ponyfill with pluggable storage adapters (IndexedDB, memory, Cache API, Node.js, Deno). Provides `showDirectoryPicker`, `showOpenFilePicker`, `showSaveFilePicker`, full `FileSystemFileHandle` and `FileSystemDirectoryHandle` interfaces.

**When to use**: When you need the full spec API on non-Chromium browsers with alternative backends.

**When NOT to use**: Stale project (2+ years without updates). The fallback experience (flat directory listing on mobile) is degraded.

### 3. native-file-system-adapter

- **npm**: `native-file-system-adapter`
- **Author**: @jimmywarting

Similar to file-system-access but more actively maintained. Reference implementation based on the spec.

### Verdict on Libraries

For **meet-ai's use case** (Chromium-only target, since this would be used alongside Chrome extension features), **no library is needed**. The raw API is simple enough (see complexity assessment below). `browser-fs-access` adds value only if you need Safari/Firefox fallback, which doesn't apply here.

---

## React Hooks

### use-fs (TimMikeladze)

- **npm**: `use-fs`
- **Stars**: 16
- **Demo**: use-fs.com

**Features**:
- `useFs()` hook with directory selection, file watching via polling
- Built-in filters (excludes dist, git, node_modules)
- Configurable poll interval (default 100ms), batch size (50 files), debounce (50ms)
- Content caching with TTL
- Returns `files` map, `writeFile()`, `deleteFile()`, status flags

**API**:
```js
const { onDirectorySelection, files, writeFile, isProcessing } = useFs({
  pollInterval: 100,
  batchSize: 50,
  filters: [distFilter, gitFilter],
  onFilesAdded: (added) => console.log('New files:', added),
  onFilesChanged: (changed) => console.log('Changed:', changed),
  onFilesDeleted: (deleted) => console.log('Deleted:', deleted),
});
```

### use-fs-access (Milan-Kovacevic)

- **Stars**: 1
- **Created**: April 2025

**Features**:
- More comprehensive API: `openDirectory`, `expandDirectory`, `openFile`, `closeFile`, `writeFile`, `createDirectory`, `renameFile`, `copyFile`, `deleteFile`
- Persistent access via IndexedDB
- Lazy-loading directory structure
- File watching with polling
- TypeScript support

**Verdict on React hooks**: Both are very small projects (1-16 stars). For a production app, writing a custom hook is probably better than depending on these. The raw API is ergonomic enough that a thin hook wrapper (~50-80 lines) would suffice.

---

## API Complexity Assessment

### Lines of code for core operations

| Operation | Lines | Complexity |
|-----------|-------|-----------|
| Open and read a single file | 3 | Trivial |
| Write/save a file | 4 | Trivial |
| Open a directory (shallow) | 3 | Trivial |
| Recursive directory walk | 12 | Simple |
| Read all files in directory tree | 20 | Simple |
| Store/retrieve handle from IndexedDB | 15 | Moderate |
| Permission check + re-request | 8 | Simple |
| Full file browser with caching | 80-120 | Moderate |

### Minimal viable implementation: ~60-80 lines

A complete "open project folder, read tree, read/write files" implementation needs about 60-80 lines of TypeScript without any library:

```ts
// Core types
interface FileEntry {
  path: string;
  handle: FileSystemFileHandle;
}

// Open directory
async function openProject(): Promise<FileSystemDirectoryHandle> {
  return await window.showDirectoryPicker({ mode: 'readwrite' });
}

// Recursive file listing with filtering
async function* listFiles(
  dir: FileSystemDirectoryHandle,
  path = '',
  ignore = new Set(['.git', 'node_modules', 'dist', '.next', '.cache'])
): AsyncGenerator<FileEntry> {
  for await (const [name, handle] of dir.entries()) {
    if (ignore.has(name)) continue;
    const fullPath = path ? `${path}/${name}` : name;
    if (handle.kind === 'file') {
      yield { path: fullPath, handle: handle as FileSystemFileHandle };
    } else {
      yield* listFiles(handle as FileSystemDirectoryHandle, fullPath, ignore);
    }
  }
}

// Read file contents
async function readFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

// Write file contents
async function writeFile(handle: FileSystemFileHandle, content: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

// Check/request permission
async function ensurePermission(
  handle: FileSystemHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  const opts = { mode } as FileSystemHandlePermissionDescriptor;
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}
```

**Assessment: The API is simple enough to use directly. No library needed for Chromium-only targets.**

---

## Permission Model & Persistence

### How permissions work

1. **Initial grant**: User picks a file/directory via the picker dialog. Read permission is granted automatically. Write permission requires a separate prompt (unless `mode: 'readwrite'` is passed to `showDirectoryPicker`).

2. **During session**: Once granted, the app can read/write freely. No re-prompting within the same tab session.

3. **Tab close**: All permissions are revoked when all tabs for the origin are closed.

4. **Next visit**: The app must re-request permission. File handles stored in IndexedDB survive, but permissions don't (by default).

### Persistent permissions (Chrome 122+)

Chrome 122 introduced a three-way prompt:
- **"Allow this time"** — Session-only (existing behavior)
- **"Allow on every visit"** — Persists until revoked
- **"Don't allow"** — Denied

**Requirements**:
1. Store `FileSystemHandle` objects in IndexedDB on first visit
2. Retrieve them on next visit
3. Call `handle.requestPermission()` to trigger the three-way prompt
4. PWAs (installed apps) automatically get persistent permissions after first grant

**Caveats**:
- If the user dismisses/denies the prompt 3+ times, Chrome falls back to one-time-only prompts
- The user can revoke individual file/directory access from Chrome site settings
- Immediate tab reloads don't trigger the persistent prompt; user must close and reopen

### IndexedDB handle storage pattern

```js
import { openDB } from 'idb';

const db = await openDB('app-fs', 1, {
  upgrade(db) {
    db.createObjectStore('handles');
  },
});

// Store
await db.put('handles', dirHandle, 'project-root');

// Retrieve
const stored = await db.get('handles', 'project-root');
if (stored) {
  const ok = await ensurePermission(stored);
  if (ok) { /* use stored handle */ }
}
```

---

## File Watching (FileSystemObserver)

### Status: Experimental / Non-standard

`FileSystemObserver` is a **Chrome-only, origin-trial** API that provides native file change notifications. It is **not standardized** and may change or be removed.

### API

```js
const observer = new FileSystemObserver((records, observer) => {
  for (const record of records) {
    console.log(record.type, record.changedHandle.name);
    // record.type: "appeared" | "disappeared" | "modified" | "moved" | etc.
  }
});

// Watch a directory recursively
await observer.observe(dirHandle, { recursive: true });

// Stop watching
observer.disconnect();
```

### Change types

- `appeared` — File/directory created or moved into watched scope
- `disappeared` — File/directory deleted or moved out
- `modified` — File contents changed
- `moved` — File/directory renamed or relocated

### Practical alternative: Polling

Since `FileSystemObserver` is non-standard, most apps use polling:

```js
async function watchDirectory(dirHandle, callback, interval = 1000) {
  let lastState = new Map();

  setInterval(async () => {
    const current = new Map();
    for await (const { path, handle } of listFiles(dirHandle)) {
      const file = await handle.getFile();
      current.set(path, file.lastModified);
    }

    // Detect changes
    for (const [path, modified] of current) {
      if (!lastState.has(path)) callback('added', path);
      else if (lastState.get(path) !== modified) callback('modified', path);
    }
    for (const path of lastState.keys()) {
      if (!current.has(path)) callback('deleted', path);
    }

    lastState = current;
  }, interval);
}
```

**Performance note**: Polling is workable for small-to-medium projects (<1,000 files). For large projects, increase the poll interval or limit the watched scope.

---

## Real-World Implementations

### vscode.dev

- Uses the File System Access API as its primary mechanism for local folder editing
- `showDirectoryPicker()` for opening folders, full recursive tree view
- Stores handles in IndexedDB (`vscode-filehandles-store` in `vscode-web-db`) for "Recent" folders
- Permission is requested once per directory; write permission covers all files within
- Demonstrates the full capability of the API for a production-grade editor

### Excalidraw

- Uses `browser-fs-access` library for cross-browser compatibility
- Stores the returned file handle for subsequent saves (true "Save" vs "Save As")
- Progressive enhancement: shows "Save As" button only when File System Access API is supported
- On unsupported browsers, falls back to download-based saving
- Pattern: `fileSave(blob, options, existingHandle || null)`

### Key takeaway

vscode.dev proves the API is mature enough for a full IDE-like experience. Excalidraw shows how to handle the cross-browser story gracefully.

---

## Limitations & Gotchas

### Critical limitations

1. **Chromium-only for real file system access** — Firefox opposes the spec, Safari has no plans. This is the biggest constraint. ~34% global browser coverage.

2. **No mobile support** — Zero support on any mobile browser. Not even Chrome Android.

3. **User gesture required** — Pickers can only be invoked from user actions (clicks, keyboard events). Cannot open programmatically on page load.

4. **Permission re-prompting** — Before Chrome 122, users had to re-grant access every session. Even with Chrome 122+, the persistent prompt requires specific conditions.

5. **No background access** — Cannot watch files from a service worker or when the tab is inactive.

### Performance gotchas

6. **Large directories are slow** — Recursive iteration through directories with thousands of files (e.g., unfiltered `node_modules`) will block the main thread. Always filter and consider using a Web Worker.

7. **Malware scanning overhead** — Chrome may run security checks on file operations, adding latency that doesn't exist in OPFS.

8. **No native search** — There's no API for searching file contents. You must read every file individually to search across a project.

### API gotchas

9. **File name validation** — The API doesn't sanitize file names. Invalid characters throw obscure errors without specifying which character is invalid.

10. **Path length limits** — Undocumented file path length limitations cause vague error messages.

11. **Empty directory requirement** — `removeEntry()` on directories only works when the directory is empty.

12. **No disk quota enforcement** — File System Access API writes (non-OPFS) are not subject to storage quotas, meaning a website could theoretically fill a user's disk.

13. **Structured clone required** — Handles can be stored in IndexedDB (they support structured clone), but not in localStorage or sessionStorage.

### Security considerations

14. **Restricted directories** — Chrome blocks access to system directories (Windows, System32, etc.), browser profile directories, and other sensitive locations.

15. **Cross-origin file sharing risk** — Multiple origins can access the same files if the user grants access to the same directory. This is one of Mozilla's primary objections.

---

## Recommendation

### For meet-ai specifically

**The File System Access API is a strong fit for meet-ai's use case**, given that:

1. meet-ai already requires Chrome (for the Chrome extension)
2. The target is desktop users working with code projects
3. The API is simple enough to use directly without libraries (~60-80 lines for core functionality)

### What to build

| Feature | Priority | Effort |
|---------|----------|--------|
| Open project folder + tree view | High | Small (< 100 lines) |
| Read file contents for AI context | High | Trivial (3 lines) |
| Drag-and-drop files into chat | High | Small (~20 lines) |
| Save AI-generated files to disk | Medium | Trivial (4 lines) |
| Persistent directory handle (IndexedDB) | Medium | Small (~30 lines) |
| File change detection (polling) | Low | Medium (~50 lines) |
| In-browser text editor with save | Low | Depends on editor choice |

### Library recommendation

**No library needed.** The raw API is ergonomic, well-typed (TypeScript declarations available via `@types/wicg-file-system-access`), and meet-ai targets Chromium only. A thin custom hook (`useFileSystem`) wrapping the core operations would be sufficient.

If cross-browser fallback ever becomes important, `browser-fs-access` (161K weekly downloads, GoogleChromeLabs maintained, used by Excalidraw) is the only library worth considering.

### TypeScript types

Install for type safety:

```bash
bun add -DE @types/wicg-file-system-access
```

This adds `FileSystemFileHandle`, `FileSystemDirectoryHandle`, `FileSystemWritableFileStream`, `showOpenFilePicker`, `showSaveFilePicker`, `showDirectoryPicker` to the global scope.
