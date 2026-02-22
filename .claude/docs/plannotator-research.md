# Plannotator Research: Plan Editing UI Features

**Source**: https://github.com/backnotprop/plannotator
**Version**: v0.8.2 (Feb 18, 2026)
**Stack**: React + TypeScript, Bun monorepo, Tailwind CSS
**Architecture**: Local plugin for Claude Code / OpenCode, opens in browser

---

## 1. Plan Display (Viewer Component)

The plan is rendered from markdown into structured blocks. The parser (`parseMarkdownToBlocks()`) converts raw markdown into a flat list of `Block` objects.

### Supported Block Types
- **Headings** (h1-h4) with responsive sizing
- **Paragraphs** with inline markdown
- **Blockquotes** with left border styling
- **Lists** (ordered/unordered) with:
  - Nesting (indentation levels)
  - Checkbox support (`[x]` / `[ ]`)
- **Code blocks** with syntax highlighting via highlight.js (language detection from fence)
- **Tables** with inline markdown in cells
- **Mermaid diagrams** for visualization (rendered via `MermaidBlock` component)
- **Horizontal rules**
- **YAML frontmatter** displayed as metadata cards

### Block Structure
```typescript
interface Block {
  id: string;           // e.g., "block-0"
  type: 'paragraph' | 'heading' | 'blockquote' | 'list-item' | 'code' | 'hr' | 'table';
  content: string;      // Plain text content
  level?: number;       // For headings (1-6) or list indentation
  language?: string;    // For code blocks
  checked?: boolean;    // For checkbox list items
  order: number;        // Sorting order
  startLine: number;    // 1-based line number in source markdown
}
```

---

## 2. Editor Modes (ModeSwitcher Component)

Three distinct annotation modes, toggled via a segmented control in the header:

### 2a. Selection Mode
- Default mode
- Select text to see annotation toolbar (Copy / Delete / Comment)
- Toolbar appears floating above selected text

### 2b. Comment Mode
- Optimized for commenting
- Select text -> toolbar appears with comment input pre-opened
- Type-to-comment: start typing immediately to begin a comment

### 2c. Redline Mode
- "Destructive" mode for marking deletions
- Selecting text auto-creates DELETION annotations
- No toolbar needed - selections immediately become deletions
- Visual styling: red/destructive color

### Mode Persistence
Editor mode is saved to localStorage via `editorMode.ts` utility, persists across sessions.

---

## 3. Annotation System

### Annotation Types (5 total)
```typescript
enum AnnotationType {
  DELETION = 'DELETION',       // Remove this text
  INSERTION = 'INSERTION',     // Add new text
  REPLACEMENT = 'REPLACEMENT', // Replace text with new text
  COMMENT = 'COMMENT',        // Comment on specific text
  GLOBAL_COMMENT = 'GLOBAL_COMMENT', // Document-level comment
}
```

### Annotation Data Structure
```typescript
interface Annotation {
  id: string;
  blockId: string;
  startOffset: number;
  endOffset: number;
  type: AnnotationType;
  text?: string;            // Comment text or replacement text
  originalText: string;     // The selected text being annotated
  createdAt: number;        // Timestamp in ms
  author?: string;          // Identity for collaborative sharing
  images?: ImageAttachment[]; // Attached images
  startMeta?: { parentTagName, parentIndex, textOffset }; // web-highlighter metadata
  endMeta?: { parentTagName, parentIndex, textOffset };
}
```

### Highlighting Library
Uses `@plannotator/web-highlighter` for:
- Creating visual highlights over selected text
- Supports cross-element text selections (spans across multiple DOM nodes)
- Different visual styles per annotation type (deletion = red/strikethrough, comment = accent)
- Imperative API: `removeHighlight(id)`, `clearAllHighlights()`, `applySharedAnnotations()`

---

## 4. Annotation Toolbar (Floating Toolbar Component)

Appears when text is selected. Two-step interface:

### Step 1: Menu Mode
Compact toolbar with icon buttons:
- **Copy** - Copy selected text to clipboard (with checkmark feedback)
- **Delete** (trash icon) - Mark selection as DELETION (immediate, no input needed)
- **Comment** (chat icon) - Opens input for COMMENT type
- Divider + **Close** button

### Step 2: Input Mode
Expanded toolbar for comments/replacements:
- **Textarea** (auto-resizing, `fieldSizing: "content"`)
- **AttachmentsButton** - Upload images to attach to annotation
- **Save button** (disabled until text/images present)
- **Back button** to return to menu

### Keyboard Shortcuts
- Start typing in menu mode -> auto-transitions to comment input
- `Enter` submits comment (Shift+Enter for newline)
- `Escape` returns to menu / closes toolbar
- Toolbar repositions on scroll/resize
- Auto-closes when element scrolls out of viewport

### Position Modes
- `center-above`: Centered above selected text (for text selections)
- `top-right`: Right-aligned above element (for code block annotations)

---

## 5. Code Block Annotations

Code blocks have special handling:
- Hover reveals annotation toolbar at top-right of code block
- Copy button to copy full code block
- Can annotate entire code block as a unit
- Syntax highlighting preserved during annotation

---

## 6. Global Comments

- Separate from text-selection annotations
- Input at top of document (button + expanding textarea)
- Type: `GLOBAL_COMMENT`
- Applies to the entire plan, not specific text
- Can include image attachments

---

## 7. Annotation Panel (Sidebar)

Resizable sidebar showing all annotations. Two variants:

### AnnotationPanel (Full-featured)
- Header with "Annotations" title + count badge
- Scrollable list sorted by document position (block order, then offset)
- Each annotation card shows:
  - Author with "(me)" suffix via identity system
  - Type badge (Delete/Insert/Replace/Comment/Global) with color coding
  - Original text in monospace box
  - Comment/replacement text with left border accent
  - Image thumbnails
  - Relative timestamp ("now", "5m", "2h", "3d")
  - Edit button -> inline textarea editing (Cmd+Enter save, Esc cancel)
  - Delete button
- Quick Share button in footer (copies share URL)
- Empty state with instructional text

### AnnotationSidebar (Compact)
- Simpler version for read-only/shared views
- Same sorting and display but without edit capabilities
- Hover-reveal delete buttons
- Color-coded type badges (destructive/secondary/primary/accent)

---

## 8. Table of Contents (Navigation)

Sidebar navigation built from document headings (h1-h3):

### Features
- Hierarchical tree (headings nested by level)
- Collapsible sections (expand/collapse chevrons)
- Click to smooth-scroll to section (with sticky header offset)
- Active section highlighting (primary color)
- **Annotation count badges** per section (calculated from all annotations in that section's block range)
- Responsive: hidden on mobile, visible on desktop
- Uses `useActiveSection` hook for scroll-spy behavior

---

## 9. Plan Approval / Rejection Flow

### Approve Button
- Sends POST to `/api/approve`
- Can include: annotations as structured feedback, permission mode, note integrations, plan save config
- Shows `CompletionOverlay` with success checkmark
- Auto-close tab after 3 seconds (configurable, can be disabled)

### Deny / Request Changes Button
- Sends POST to `/api/deny` with feedback
- Feedback = `exportDiff()` output: structured markdown with all annotations
- Shows `CompletionOverlay` with chat bubble icon
- Auto-close behavior same as approve

### Feedback Export Format (`exportDiff()`)
Generates structured markdown:
```
# Plan Feedback

## Reference Images (if any)

I've reviewed this plan and have N pieces of feedback:

## 1. Remove this
[original text in code block]
> I don't want this in the plan.

## 2. Change this
**From:** [original] **To:** [replacement]

## 3. Feedback on: "selected text"
> comment text

## 4. General feedback about the plan
> global comment text
```

### CompletionOverlay
- Full-screen overlay after submission
- Shows approved (checkmark) or feedback (chat bubble) icon
- Title + subtitle text
- Auto-close countdown (3 seconds default, configurable in settings)
- Fallback: manual close instructions if auto-close fails
- Checkbox to enable/disable auto-close

---

## 10. Sharing & Collaboration

### URL-Based Sharing (No Backend)
- Compresses plan + annotations via `deflate-raw` into base64url
- Entire state encoded in URL hash fragment
- Share URL generated automatically when annotations change
- URL size displayed (bytes/KB)

### Share Payload Format
```typescript
interface SharePayload {
  p: string;                    // markdown content
  a: ShareableAnnotation[];     // compact annotations
  g?: [string, string][];       // global image attachments [path, name]
}
```

### Import Teammate Annotations (ImportModal)
- Paste a share link from teammate
- Imports annotations with deduplication (compares originalText + type + text)
- Shows import count and success/error feedback
- Auto-closes after successful import (1.5s)

### Identity System (`identity.ts`)
- Each user gets a unique "Tater" identity
- Used to distinguish annotations from different authors
- `isCurrentUser()` check for edit/delete permissions

---

## 11. Image Annotation (ImageAnnotator)

Full drawing tool overlay for annotating screenshots/images:

### Drawing Tools
- **Pen** - Freehand drawing (key: 1)
- **Arrow** - Directional arrows (key: 2)
- **Circle** - Circle/ellipse outlines (key: 3)

### Controls
- Color picker
- Stroke size adjustment
- Undo (Cmd/Ctrl+Z)
- Clear all drawings
- Save/Accept

### Workflow
1. User uploads/pastes an image
2. Image opens in full-screen annotator overlay
3. Draw annotations on the image
4. Accept: composites drawings onto image at full resolution
5. Resulting annotated image attached to annotation or plan

### Keyboard Shortcuts
- `1/2/3` switch tools
- `Cmd+Z` undo
- `Escape` or `Enter` accept
- Click outside to accept

### Image Attachments
- `AttachmentsButton` component for inline image upload
- `ImageThumbnail` component for preview
- Images uploaded via `/api/upload` to temp directory
- Served via `/api/image` endpoint

---

## 12. Settings

### General Tab
- **Your Identity** - Unique "Tater" identity with regenerate option
- **Permission Mode** (Claude Code only) - What happens after plan approval:
  - `acceptEdits`: Auto-approve file edits, ask for other tools (default)
  - `bypassPermissions`: Auto-approve all tool calls
  - `default`: Manually approve each tool call
- **Agent Switching** (OpenCode only) - Which agent to switch to after approval
- **Auto-close Tab** - Configurable delay for closing tab after submission

### Display Tab
- **Table of Contents** toggle (sidebar navigation on desktop)
- **Sticky Actions** toggle (keep action buttons visible while scrolling)
- **Tater Mode** toggle (mascot/fun mode)

### Saving Tab
- **Save Plans** toggle - Auto-save to `~/.plannotator/plans/`
- **Custom Path** - Override default save location
- **Default Save Action** - What Cmd+S does (ask, download, Obsidian, Bear)
- **Obsidian Integration** - Vault selection, folder config, frontmatter setup
- **Bear Notes** toggle - Auto-save to Bear app

---

## 13. Permission Mode Setup (First-Run)

`PermissionModeSetup` component:
- Shown on first use (checks `needsPermissionModeSetup()`)
- One-time setup wizard for selecting permission behavior
- Saves preference for future sessions

`UIFeaturesSetup` component:
- Setup for display preferences (ToC, sticky actions, etc.)

---

## 14. Keyboard Shortcuts (Global)

- `Cmd/Ctrl + Enter` - Submit/approve plan
- `Cmd/Ctrl + S` - Save (configurable action)
- `Escape` - Close toolbar/modal/overlay
- `1/2/3` in image annotator - Switch tools
- `Cmd/Ctrl + Z` in image annotator - Undo

---

## 15. Resizable Panels

Two resizable panel systems (`ResizeHandle` + `useResizablePanel` hook):
1. **Annotation panel** - Right sidebar, drag to resize
2. **Table of Contents** - Left sidebar, drag to resize

---

## 16. Theme Support

`ThemeProvider` + `ModeToggle` components:
- Light/dark mode toggle
- System preference detection
- Theme persisted in localStorage

---

## 17. Update Banner

`UpdateBanner` component with `useUpdateCheck` hook:
- Checks for new Plannotator versions
- Shows dismissible banner when update available

---

## 18. Plan Saving

`planSave.ts` utility:
- Auto-save plans to local filesystem (`~/.plannotator/plans/`)
- Custom path override
- Save on approve or deny

### Note-Taking App Integration
- **Obsidian**: Save to vault with frontmatter, folder, tags
- **Bear Notes**: Save to Bear app via x-callback-url

---

## 19. Code Review (Separate Feature)

Located in `packages/review-editor/` - A separate interface for reviewing git diffs:

### Code Review Types
```typescript
type CodeAnnotationType = 'comment' | 'suggestion' | 'concern';

interface CodeAnnotation {
  id: string;
  type: CodeAnnotationType;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  side: 'old' | 'new';      // Deletion or addition side
  text?: string;
  suggestedCode?: string;
  createdAt: number;
  author?: string;
}
```

Triggered via `/plannotator-review` slash command. Shows git diff with inline annotation capabilities.

---

## 20. Annotate Mode (Separate Feature)

Triggered via `/plannotator-annotate <file>`. Parses arbitrary markdown files for annotation. Uses the same annotation UI but with feedback sent back to agent.

---

## Summary of All Interactive UI Features

| Feature | Component(s) | Description |
|---------|-------------|-------------|
| Markdown rendering | Viewer.tsx | Renders plan as structured blocks |
| Text selection + toolbar | AnnotationToolbar.tsx | Floating toolbar on text select |
| 3 editor modes | ModeSwitcher.tsx | Selection / Comment / Redline |
| 5 annotation types | types.ts | Delete / Insert / Replace / Comment / Global |
| Annotation sidebar | AnnotationPanel.tsx | List, edit, delete annotations |
| Table of contents | TableOfContents.tsx | Hierarchical nav with annotation counts |
| Approve/Deny flow | CompletionOverlay.tsx | Full-screen completion states |
| URL sharing | useSharing.ts, sharing.ts | Compress state to URL hash |
| Import annotations | ImportModal.tsx | Merge teammate annotations |
| Export diff | ExportModal.tsx, parser.ts | Share, download, save to notes |
| Image annotation | ImageAnnotator/ | Pen, arrow, circle drawing tools |
| Image attachments | AttachmentsButton.tsx | Upload + attach images |
| Permission modes | PermissionModeSetup.tsx | Post-approval automation level |
| Settings | Settings.tsx | Identity, display, saving config |
| Resizable panels | ResizeHandle.tsx | Drag to resize sidebars |
| Theme toggle | ThemeProvider.tsx, ModeToggle.tsx | Light/dark mode |
| Keyboard shortcuts | Global in App.tsx | Cmd+Enter, Cmd+S, Escape |
| Mermaid diagrams | MermaidBlock.tsx | Render diagrams in plans |
| Code review | review-editor/ | Git diff annotation (separate) |
