# browser-fs-access Library Deep-Dive

Research date: 2026-02-21
Researcher: browser-fs-access-researcher

## 1. What is browser-fs-access?

`browser-fs-access` is a ponyfill by GoogleChromeLabs that wraps the File System Access API with transparent fallbacks for non-supporting browsers. It is NOT a polyfill -- it does not patch global APIs. Instead, it exports its own functions that internally feature-detect and route to the appropriate implementation.

- **Repository**: https://github.com/GoogleChromeLabs/browser-fs-access
- **npm**: https://www.npmjs.com/package/browser-fs-access
- **Version**: 0.38.0 (latest as of Feb 2026)
- **License**: Apache-2.0
- **Weekly downloads**: ~161K
- **Dependencies**: Zero
- **Maintained by**: Google Chrome Labs (Thomas Steiner)

## 2. API Surface

### Exports

```typescript
// Auto-detecting (recommended)
fileOpen(options?)    // Open file(s)
directoryOpen(options?) // Open directory
fileSave(blob, options?, existingHandle?, throwIfExistingHandleNotGood?) // Save file

// Explicit implementations
fileOpenModern()      // Native File System Access API
fileOpenLegacy()      // <input type="file"> fallback
directoryOpenModern()
directoryOpenLegacy()
fileSaveModern()
fileSaveLegacy()

// Feature detection
supported: boolean    // true if File System Access API is available
```

### Key Options

**fileOpen:**
- `mimeTypes: string[]` -- MIME type filters
- `extensions: string[]` -- File extension filters
- `multiple: boolean` -- Allow multiple file selection
- `description: string` -- Human-readable description for the picker
- `startIn: WellKnownDirectory | FileSystemHandle` -- Starting directory
- `id: string` -- Persist last-used directory across sessions
- `excludeAcceptAllOption: boolean`

**directoryOpen:**
- `recursive: boolean` -- Include subdirectories
- `mode: 'read' | 'readwrite'` -- Access mode
- `startIn`, `id`, `skipDirectory`

**fileSave:**
- `fileName: string` -- Suggested filename
- `extensions: string[]`
- `startIn`, `id`, `excludeAcceptAllOption`
- `legacySetup: (resolve, reject, input) => void` -- Custom legacy cancel handling

### TypeScript Types

Full TypeScript definitions included in `index.d.ts`:
- `FileWithHandle` -- File + optional `FileSystemFileHandle`
- `FileWithDirectoryAndFileHandle` -- File + optional directory/file handles
- `WellKnownDirectory` -- `'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'`
- `FileSystemPermissionMode` -- `'read' | 'readwrite'`

### Return Values

- `fileOpen()` returns `Promise<FileWithHandle>` or `Promise<FileWithHandle[]>` (if `multiple: true`)
- `directoryOpen()` returns `Promise<FileWithDirectoryAndFileHandle[]>`
- `fileSave()` returns `Promise<FileSystemFileHandle | null>` (null on legacy)
- All returned File objects have a `.handle` property when using native API

## 3. How the Fallback Works

### Reading Files (fileOpen)

| Feature | Chrome/Edge (native) | Firefox/Safari (legacy) |
|---------|---------------------|------------------------|
| Mechanism | `window.showOpenFilePicker()` | Creates hidden `<input type="file">`, clicks it |
| File handle returned | Yes (`FileSystemFileHandle`) | No (just raw `File` object) |
| MIME type filtering | Via picker `types` option | Via `accept` attribute |
| Multiple files | Yes | Yes |
| Cancel detection | `AbortError` thrown | `cancel` event on input (less reliable) |
| Persist directory | Via `id` parameter | No |
| UX | Native OS file picker | Native OS file picker (same visual) |

**Key insight**: For reading files, the UX is nearly identical. Both native and legacy open the same OS-level file picker dialog. The main difference is that the native version returns a `FileSystemFileHandle` that can be used later for writing back.

### Saving Files (fileSave)

| Feature | Chrome/Edge (native) | Firefox/Safari (legacy) |
|---------|---------------------|------------------------|
| Mechanism | `FileSystemFileHandle.createWritable()` | Creates `<a download>` link, clicks it |
| Overwrite original file | YES | NO -- always downloads new file |
| User chooses location | Yes (Save As dialog) | No (goes to Downloads) |
| Error handling | Full exceptions (disk full, permissions) | No exception support |
| Streaming support | Yes (`WritableStream`) | Converts stream to blob first |
| Returns handle | Yes | null |

**Critical limitation**: On non-Chrome browsers, `fileSave()` triggers a **download** to the user's Downloads folder. There is NO way to write back to the original file. The user gets a copy, not an in-place save.

### Opening Directories (directoryOpen)

| Feature | Chrome/Edge (native) | Firefox/Safari (legacy) |
|---------|---------------------|------------------------|
| Mechanism | `window.showDirectoryPicker()` | `<input type="file" webkitdirectory>` |
| Returns handles | Yes (`FileSystemDirectoryHandle`) | No (just File objects) |
| Recursive listing | Via async iterator | Via `webkitRelativePath` filtering |
| Write access | Yes (with `mode: 'readwrite'`) | NO |
| Large directories | Sometimes fails (~17K+ files) | Works reliably |

## 4. Bundle Size

- **Zero dependencies**
- **Unpacked size**: ~43 KB (includes both native + legacy code paths)
- **Tree-shakeable**: Yes -- import only what you need
- **Module formats**: ESM (`dist/index.modern.js`), CJS (`dist/index.cjs`)
- **Built with**: microbundle

The library is designed so that bundlers will only include the code paths actually used. If you only use `fileOpen`, the save and directory code is excluded.

Estimated effective sizes:
- `fileOpen` only: ~1-2 KB gzipped
- Full library: ~3-5 KB gzipped
- With tree-shaking, real-world impact is minimal

## 5. Browser Support Matrix

### File System Access API (native)

| Browser | Support | Since |
|---------|---------|-------|
| Chrome | Full | v105+ (partial from v86) |
| Edge | Full | v105+ (partial from v86) |
| Opera | Full | v91+ (partial from v72) |
| Firefox | NONE | Mozilla has negative position |
| Safari | NONE | Not implemented |
| Chrome Android | NONE | Not available on mobile |
| Safari iOS | NONE | Not available on mobile |
| Samsung Internet | NONE | Not available |

**Global coverage**: ~34% of users have native support.

### With browser-fs-access fallback

| Feature | Chrome/Edge | Firefox | Safari | Mobile |
|---------|------------|---------|--------|--------|
| Open files | Native | Fallback (input) | Fallback (input) | Fallback (input) |
| Open directory | Native | Fallback (webkitdir) | Fallback (webkitdir) | Limited |
| Save (new file) | Native | Fallback (download) | Fallback (download) | Fallback (download) |
| Save (overwrite) | Native | NOT POSSIBLE | NOT POSSIBLE | NOT POSSIBLE |
| File handles | Yes | No | No | No |
| Persist directory | Yes | No | No | No |

## 6. Mozilla's Position on File System Access API

Mozilla has taken an **official NEGATIVE position** on the File System Access API (GitHub issue mozilla/standards-positions#154, closed with PR #545).

**Their concerns:**
1. Security risk of arbitrary file/directory access
2. Cross-origin sharing issues not adequately addressed in the spec
3. Insufficient safety research for general file system access
4. Potential for data exfiltration attacks

**Exception**: Mozilla acknowledges that `getOriginPrivateDirectory()` (Origin Private File System / OPFS) is "far less problematic" and they DO support OPFS. But OPFS is sandboxed -- it does NOT give access to real user files.

**Implication**: Firefox will likely NEVER support the full File System Access API. This is not a "not yet" -- it is a firm "no".

## 7. Real-World Usage

### Excalidraw (primary showcase)

Excalidraw is the canonical example of browser-fs-access in production:
- Uses `fileOpen()` to load `.excalidraw` files
- Uses `fileSave()` with handle persistence for true save/overwrite
- On Chrome: shows both "Save" and "Save As" buttons
- On Safari/Firefox: shows only "Save" button that triggers a download
- The degraded experience is acceptable for Excalidraw because their file format is self-contained (single JSON file)

### Other Users
- **SVGcode** -- raster-to-SVG converter by Thomas Steiner (library author)
- Various drawing/editor apps that need open-edit-save workflows

### Known Issues (from GitHub)
- **Large directories**: `directoryOpen` sometimes fails with ~17K+ files in Chrome (works in Firefox/Safari via legacy)
- **AbortError on Firefox**: Legacy fallback can throw unexpected AbortErrors on single clicks
- **Chrome extension incompatibility**: ES6 module imports don't work in content scripts
- **iOS Safari**: Requires DOM-appended input elements for reliable `change` events

## 8. Alternative Libraries

### native-file-system-adapter (by jimmywarting)

- **npm**: `native-file-system-adapter`
- **Approach**: Full ponyfill with pluggable storage backends
- **Backends**: Native, IndexedDB, Memory, Cache API, Sandbox (deprecated)
- **Difference from browser-fs-access**: More ambitious -- tries to provide a full file system abstraction using IndexedDB/Cache as storage
- **Limitation**: Still cannot write to real files on non-Chrome. The storage backends are virtual file systems, not real disk access.

### file-system-access (by use-strict)

- **npm**: `file-system-access`
- **GitHub**: https://github.com/use-strict/file-system-access
- **Approach**: Fork/evolution of native-file-system-adapter
- **Written in TypeScript** with full type declarations
- **Multiple backends**: Node.js fs, Deno, IndexedDB, Memory, Cache API
- **Better Safari support** and stricter error handling
- **Same fundamental limitation**: Virtual file systems, not real disk access on non-Chrome

### Comparison

| Library | Size | Real file write on non-Chrome | Approach |
|---------|------|-------------------------------|----------|
| browser-fs-access | Tiny (~3-5KB gz) | No (download only) | Thin wrapper + fallback |
| native-file-system-adapter | Medium | No (virtual FS only) | Full ponyfill + backends |
| file-system-access | Medium | No (virtual FS only) | Full ponyfill + backends (TS) |
| Raw API + feature detect | Zero | No | DIY |

**None of these libraries can make non-Chrome browsers write to real files.** This is a browser engine limitation, not a library limitation.

## 9. Recommendation for meet-ai

### Context

meet-ai needs file system access for editing CLAUDE.md files -- a workflow that requires:
1. Opening a file from disk
2. Editing it in the browser
3. **Writing changes back to the original file location**

Step 3 is the critical requirement. Without it, users would have to manually copy files from Downloads, which is unacceptable UX.

### Verdict: Use raw File System Access API + feature detection

**Do NOT use browser-fs-access.** Here is why:

1. **The fallback is not useful for meet-ai's use case.** browser-fs-access's value proposition is graceful degradation. But for meet-ai, the degraded experience (download to Downloads folder) is so poor that it's not worth supporting. Users who need to edit CLAUDE.md need true write-back.

2. **The library adds nothing for Chrome.** On Chrome, the raw File System Access API is straightforward:
   ```typescript
   // Open
   const [handle] = await window.showOpenFilePicker();
   const file = await handle.getFile();

   // Save back
   const writable = await handle.createWritable();
   await writable.write(content);
   await writable.close();
   ```
   This is ~10 lines of code. Adding a dependency for this is over-engineering.

3. **Bundle size is not the issue -- utility is.** Even though browser-fs-access is tiny, adding ANY dependency for a feature that only works on one browser engine anyway is unnecessary complexity.

### Recommended Strategy

```
Chrome/Edge (v105+)  --> Full experience: open, edit, save with File System Access API
Firefox/Safari       --> Feature hidden or show "copy to clipboard" + manual paste fallback
Mobile browsers      --> Feature hidden entirely
```

**Implementation approach:**
1. Feature-detect with `'showOpenFilePicker' in window`
2. Show the file editing UI only when supported
3. On unsupported browsers, show a clear message: "File editing requires Chrome or Edge. You can copy the content and paste it into your editor."
4. Do NOT use browser-fs-access -- it would add a dependency that provides fallback behavior we don't want to expose

### Alternative: Clipboard-based fallback

For non-Chrome browsers, instead of file picker degradation:
- Show a textarea with the CLAUDE.md content
- Provide a "Copy to clipboard" button
- Users paste into their editor of choice
- This is honest UX -- no pretending to "save" when you're actually downloading

## 10. Summary

| Question | Answer |
|----------|--------|
| Should we use browser-fs-access? | **No** |
| Why not? | Its fallback (download) is unusable for our write-back requirement |
| What should we use instead? | Raw File System Access API + feature detection |
| What about non-Chrome users? | Hide the feature or offer clipboard-based fallback |
| Will Firefox ever support the API? | Unlikely -- Mozilla has a firm negative position |
| Will Safari ever support it? | No indication of plans |
| Is browser-fs-access a good library? | Yes, for apps where download-as-save is acceptable (like Excalidraw). Just not for our use case. |
