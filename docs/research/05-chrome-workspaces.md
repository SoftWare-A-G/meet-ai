# Chrome File System Access for Web Apps

Research date: 2026-02-21

## Executive Summary

**Yes, it is feasible.** Chrome (and Chromium-based browsers) support the **File System Access API**, which allows web apps to read and write files/directories on the user's local machine with explicit user consent. This is a real, shipping web standard used by production apps like VS Code for the Web (vscode.dev) and Excalidraw. However, it is **Chromium-only** -- Firefox and Safari do not support the key methods (`showDirectoryPicker`, `showOpenFilePicker`, `showSaveFilePicker`).

---

## 1. File System Access API

### What It Is

The [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API) is a web platform API that lets web apps interact with the user's local file system. It provides three main picker methods:

- **`window.showOpenFilePicker()`** -- user selects one or more files to open
- **`window.showSaveFilePicker()`** -- user selects a location to save a file
- **`window.showDirectoryPicker()`** -- user selects a directory, giving the app access to its entire tree

### How It Works

1. App calls `showDirectoryPicker()` (requires user gesture, e.g., button click)
2. Browser shows a native directory picker dialog
3. User selects a folder and grants permission
4. App receives a `FileSystemDirectoryHandle` with access to enumerate, read, and optionally write files
5. Handles can be stored in IndexedDB for later reuse

### Key Capabilities

- **Read files**: Full read access to all files in the selected directory tree
- **Write files**: With `mode: 'readwrite'`, app can create, modify, and delete files
- **Watch for changes**: Can re-read directory contents to detect changes
- **Recursive traversal**: Can walk the entire directory tree
- **Streaming**: Supports streaming reads/writes for large files

### Code Example

```javascript
// User clicks a button to open a directory
const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

// Iterate over files
for await (const [name, handle] of dirHandle) {
  if (handle.kind === 'file') {
    const file = await handle.getFile();
    const text = await file.text();
    console.log(name, text.length);
  }
}

// Write a file
const fileHandle = await dirHandle.getFileHandle('notes.md', { create: true });
const writable = await fileHandle.createWritable();
await writable.write('# Hello from the web app');
await writable.close();
```

---

## 2. Browser Support

### Supported

| Browser         | Version   | Notes                                  |
|-----------------|-----------|----------------------------------------|
| Chrome          | 86+ (full from 105+) | Full support, persistent permissions from 122 |
| Edge            | 86+ (full from 105+) | Same Chromium engine                   |
| Opera           | 73+ (full from 91+)  | Same Chromium engine                   |

### NOT Supported

| Browser          | Status                                          |
|------------------|--------------------------------------------------|
| Firefox          | Not supported, no plans to implement             |
| Safari           | Not supported (partial File System API only)     |
| Chrome Android   | Not supported                                    |
| Safari iOS       | Not supported                                    |

### Global reach: ~34% of users (Chromium desktop only)

This is a significant limitation. The API is essentially **Chrome/Edge desktop only**. For meet-ai, this could be acceptable since agent/developer workflows are primarily desktop Chrome, but it would need graceful degradation for other browsers.

---

## 3. Security Model

### Permissions

- **User gesture required**: Picker methods can only be called from a user gesture (click, keypress)
- **HTTPS required**: Only works in secure contexts
- **Per-origin scoping**: Permissions are tied to the origin (e.g., `https://meet-ai.cc`)
- **Explicit consent**: User must actively select the directory -- no silent access

### Persistent Permissions (Chrome 122+)

Chrome 122 introduced a three-way permission prompt:
1. **"Allow this time"** -- access for current session only
2. **"Allow on every visit"** -- indefinite access until revoked
3. **"Don't allow"** -- denied

With persistent permissions:
- Handles stored in IndexedDB survive browser restarts
- App can call `handle.requestPermission()` on stored handles
- Installed PWAs get automatic persistent permissions
- Users can manage/revoke access in Chrome site settings

### Blocked Paths

The browser blocks access to:
- OS system directories (Windows, macOS Library, etc.)
- User's entire home directory
- Root filesystem
- Certain file types (executables on some platforms)

---

## 4. Origin Private File System (OPFS)

OPFS is a **separate, complementary** API. It provides a virtual file system private to the origin, **not** access to the user's real files.

| Feature                    | File System Access API        | OPFS                        |
|----------------------------|-------------------------------|-----------------------------|
| Access to real files       | Yes                           | No (sandboxed storage)      |
| User picks files           | Yes (picker dialog)           | No (invisible to user)      |
| Browser support            | Chromium only                 | All modern browsers         |
| Permissions needed         | Yes (user must grant)         | No                          |
| Performance                | Standard file I/O             | Highly optimized            |
| Use case                   | Edit user's local files       | App-internal storage        |

**For meet-ai's use case (browsing/editing user's local files), OPFS is not relevant.** OPFS is for app-internal storage (like a database), not for accessing the user's filesystem.

---

## 5. Chrome DevTools Workspaces

Chrome DevTools Workspaces is a **developer tool feature**, not a web API. It:
- Maps network resources to local files in DevTools Sources panel
- Allows editing source files directly from DevTools
- Supports automatic workspace discovery via `devtools.json`
- Is designed for development workflows, not end-user web apps

**This is NOT usable by web apps.** It's purely a DevTools feature for developers.

---

## 6. Real-World Examples

### VS Code for the Web (vscode.dev)
The flagship example. Uses `showDirectoryPicker()` to open local project folders. Users can browse, edit, create, and delete files entirely from the browser. All changes write directly to the local filesystem.

### Excalidraw
Uses the [browser-fs-access](https://github.com/nickersk/browser-fs-access) library, which wraps the File System Access API with fallbacks for unsupported browsers. Opens and saves `.excalidraw` files directly to/from the local filesystem.

### Other Examples
- **Squoosh** (image compression app by Google) -- open/save images locally
- **edit.photo** -- edit photos with direct local file access
- Web-based CSV/spreadsheet editors
- In-browser audio/video editors

---

## 7. Feasibility for meet-ai

### What We Could Build

A "Workspaces" feature in the meet-ai chat UI where users can:
1. Click "Open Folder" to select a local project directory
2. See a file tree sidebar showing the directory contents
3. Click files to view their contents (syntax-highlighted code, markdown rendered, etc.)
4. Optionally edit files from the web UI
5. Agents could reference file paths, and the UI could show the actual file content inline

### Technical Implementation

```
User clicks "Open Folder"
  -> showDirectoryPicker({ mode: 'readwrite' })
  -> Store handle in IndexedDB for persistence
  -> Recursively read directory tree
  -> Display file tree in sidebar
  -> On file click: read file content, display with syntax highlighting
  -> On save: write changes back to disk
```

### Advantages
- No server involvement -- all file access is client-side
- No extensions or plugins needed
- Works in any Chromium browser on desktop
- Persistent permissions mean users don't re-grant every visit (Chrome 122+)
- Real local file access, not uploads/copies

### Limitations & Risks
- **Chromium-only**: Firefox/Safari users would need a fallback (file upload/download)
- **Desktop only**: Mobile browsers don't support this
- **No file watching**: Can't detect external changes in real-time (must poll or re-read)
- **No terminal/shell access**: Just file read/write, no command execution
- **Permission UX**: Users must grant access each session (unless persistent permissions are enabled)
- **Large directories**: Reading very large project trees could be slow
- **Binary files**: Need to handle binary files gracefully (images, compiled files)

### Recommendation

**Worth exploring as an opt-in feature for Chrome desktop users.** The API is stable, well-documented, and used by major production apps. For meet-ai, a workspace feature could:
- Let users reference local files in conversations with agents
- Let agents suggest file changes that users can preview and apply
- Display relevant code/docs inline when discussing projects

Graceful degradation for non-Chrome browsers could fall back to traditional file upload/download or simply hide the feature.

---

## Sources

- [MDN: File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)
- [MDN: showDirectoryPicker()](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker)
- [Chrome: File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)
- [Chrome: Persistent Permissions](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)
- [Can I Use: File System Access API](https://caniuse.com/native-filesystem-api)
- [MDN: Origin Private File System](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
- [Chrome: DevTools Workspaces](https://developer.chrome.com/docs/devtools/workspaces)
- [Excalidraw: browser-fs-access](https://blog.excalidraw.com/browser-fs-access/)
- [VS Code Web + File System Access](https://medium.com/@devedium/a-practical-example-of-using-the-file-system-access-api-vscode-dev-e29f45387445)
