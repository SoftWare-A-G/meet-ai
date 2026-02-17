# Expo App Milestones — Overview

> Generated 2026-02-17 from PRD v1.0 + codebase audit

## Milestone Order

| # | Topic | Goal | Dependencies | Status |
|---|-------|------|-------------|--------|
| 1 | Message List Performance | Replace FlatList with FlashList v2, add pagination, memoize components | None | **8/8 DONE** |
| 2 | Keyboard & Input Bar | Migrate to react-native-keyboard-controller, auto-grow input, send button animation | None (can run parallel with M1) | **7/9** (send button animation skipped) |
| 3 | Optimistic Send & Connection Status | Optimistic message sending with status indicators, offline queue, connection quality UI | M1 (FlashList must be in place) | **9/9 DONE** |
| 4 | Animations & Haptics | Message appear animations, new-message pill, log group expand/collapse, haptic feedback | M1 (FlashList), M2 (input bar) | **8/10** (FadeInDown removed per user pref) |
| 5 | Accessibility & Platform Polish | Full a11y labels, screen reader support, platform-specific UX (iOS/Android differences) | M1-M4 (polish pass over completed features) | **9/11** (touch targets partial, status bar TBD) |

## Key Audit Findings Incorporated

From `docs/plans/2026-02-17-codebase-audit.md`:

- **`rooms/[id].tsx` is 503 lines** — M1 includes extracting MessageBubble, LogGroup, and markdown styles before FlashList migration
- **No pagination** — All messages loaded at once. M1 adds scroll-to-top pagination.
- **No `React.memo`** — Inline `renderItem` re-creates every render. M1 memoizes extracted components.
- **`KeyboardAvoidingView` in use** — M2 replaces with `react-native-keyboard-controller`.
- **No optimistic updates** — `handleSend` waits for server. M3 adds optimistic send.
- **Reanimated installed but unused** — M4 puts it to work for animations.
- **Zero accessibility labels** — M5 adds full a11y coverage.
- **Hardcoded sender name** ("Mobile User") — noted, but fixing requires a Profile screen (Phase 2).

## Completion Summary (2026-02-18 Audit)

**Overall: 41/47 acceptance criteria met (87%)**

### Remaining Items
1. **M2: Send button scale animation** — Not implemented. Button uses opacity-based press feedback instead of Reanimated scale animation. Low priority.
2. **M4: FadeInDown message animation** — Intentionally removed per user preference to avoid jank with FlashList cell recycling.
3. **M5: 44pt touch targets** — Most elements meet 44pt (send button, pill, agents button). Retry button on failed messages and log group toggle header are undersized.
4. **M5: Status bar theme** — No explicit `StatusBar` component managing barStyle. Navigation theme handles header, but status bar appearance is not explicitly controlled.
5. **M1: estimatedItemSize** — Not set on FlashList. Auto-estimation works but explicit value could improve initial render.

## Scope Boundary

These milestones cover **Phase 1** features only — improvements to the existing chat experience. The following are explicitly **out of scope** for all milestones:

- Media handling (images, audio, video, files) — Phase 2
- Push notifications — Phase 2
- Offline persistence (expo-sqlite) — Phase 2
- @mentions / rich text input (react-native-enriched) — Phase 2
- Room creation from mobile — Phase 2
- Message reactions, threading, search — Phase 2
- Profile/Room settings screens — Phase 2
