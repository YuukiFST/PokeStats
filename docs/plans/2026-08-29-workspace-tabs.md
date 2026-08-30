# Workspace tabs Implementation Plan

> **For agentic workers:** Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-app workspace tabs so any PokeStats route can stay open while others are used, with Ctrl/Cmd/middle/right-click opening a new tab.

**Architecture:** Pure tab-stack state plus a provider that mirrors the active tab onto TanStack Router. Browser `history.push` is coerced to `replace`; `popstate` is trapped so Back applies only to the active tab. Same-origin `<a>` clicks with modifiers open a new tab; pathname changes push on the tab stack, search-only changes replace.

**Tech Stack:** React 19, TanStack Router, Vitest, existing i18n dict.

**Spec:** `docs/specs/2026-08-29-workspace-tabs-design.md`

## Global Constraints

- Tabs are session-only (no `localStorage` for the tab list).
- Do not persist or restore tabs on reload.
- Do not bind `Ctrl+W` or `Ctrl+Tab`.
- Do not change Form stats/sets or Teams section tabs except that they keep using the current workspace tab.
- Copy in both `en` and `pt-BR` via `src/lib/i18n.tsx`.
- Tests live next to the unit under test (`src/**/*.test.ts`), Vitest, Node environment.

---

### Task 1: Tab stack reducer

**Files:**
- Create: `src/lib/workspace/state.ts`
- Test: `src/lib/workspace/state.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `LocationSnapshot`, `WorkspaceTab`, `WorkspaceState`, `createInitialState`, `pushInTab`, `replaceInTab`, `openTab`, `activateTab`, `closeTab`, `goBack`, `goForward`, `currentLocation`, `hrefOf`, `snapshotFromHref`

- [ ] **Step 1: Write the failing test** in `src/lib/workspace/state.test.ts` covering: initial tab, push then back, replace same index, openTab inserts after active and focuses it, close non-active, close active selects right neighbor, close last tab resets to fallback Dex, goBack at index 0 is a no-op.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/workspace/state.test.ts`

- [ ] **Step 3: Implement `state.ts`** with the functions named above. `openTab` uses `seq` to mint `tab-N`. `closeTab(state, id, fallback)` never yields zero tabs.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `pnpm test src/lib/workspace/state.test.ts`

---

### Task 2: Provider, tab bar, router wiring

**Files:**
- Create: `src/lib/workspace/WorkspaceProvider.tsx`
- Create: `src/lib/workspace/title.ts`
- Create: `src/components/layout/TabBar.tsx`
- Modify: `src/App.tsx` (history.push → replace; wrap root with provider)
- Modify: `src/components/layout/Shell.tsx` (render `TabBar` above `children`)
- Modify: `src/lib/i18n.tsx` (workspace strings)

**Interfaces:**
- Consumes: Task 1 exports
- Produces: `useWorkspace()` with `{ tabs, activeId, current, activate, close, openInNewTab, newTab, back, canBack }`

- [ ] **Step 1: Implement provider** that: initializes from `router.state.location`; on `onResolved` records replace vs push by comparing pathnames unless `skipRecordRef`; intercepts capture-phase `click` / `auxclick` / `contextmenu` on same-origin in-app anchors; installs a `popstate` trap that calls `goBack`/`goForward` and `router.navigate({ replace: true })`; exposes the API above.

- [ ] **Step 2: Implement `TabBar`** (horizontal strip, active styles using existing `--ds-*` tokens, ×, middle-click close, + new Dex tab). Labels via `tabTitle()` plus dataset names for `/form/$id` and `/moves/$id`.

- [ ] **Step 3: Wire Shell + App** and i18n keys: `workspace.openInNewTab`, `workspace.closeTab`, `workspace.newTab`, `workspace.dex`, `workspace.compare`.

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc -b --pretty false`

---

### Task 3: Non-anchor navigations honor new-tab modifiers

**Files:**
- Modify: `src/routes/dex.tsx` (Form name `Link`; Compare control)
- Modify: `src/routes/moves.tsx` (row `Link`)
- Modify: `src/hooks/usePalette.tsx` (Ctrl/Cmd on result click)
- Modify: `src/routes/formDetail.tsx`, `src/routes/compare.tsx`, `src/routes/moveDetail.tsx`, `src/routes/typeDetail.tsx` (in-app Back → `useWorkspace().back`)

- [ ] **Step 1: Convert Dex name and Moves rows to `Link`** so the document interceptor applies.

- [ ] **Step 2: Compare and palette** call `openInNewTab` when the click is modified.

- [ ] **Step 3: Back buttons** call `workspace.back()` (stack back, or Dex if at the start).

- [ ] **Step 4: Run** `pnpm test` and `pnpm exec tsc -b --pretty false`
