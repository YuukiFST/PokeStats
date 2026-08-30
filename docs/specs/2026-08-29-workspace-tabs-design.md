# Workspace tabs

Date: 2026-08-29

## Problem

PokeStats shows one route at a time. A user who is looking at one Form, another Form, and a Compare view has to throw away the previous screen on every click.

## Goal

In-app document tabs, in the same sense as Zed / VS Code / WezTerm: several screens stay mounted in a tab strip; only the active one is shown. The left sidebar stays as it is.

## Out of scope

- Persisting tabs across reload or a new browser session
- Split panes
- Stealing browser shortcuts that close or switch *browser* tabs (`Ctrl+W`, `Ctrl+Tab`)
- Changing in-page section tabs (Form stats/sets, Teams team/analysis/matchup)

## Behavior

### Opening

- A **plain left click** on an in-app link (or an equivalent control) navigates **inside the current workspace tab**.
- **Ctrl+click**, **Cmd+click** (macOS), or **middle-click** opens the destination in a **new workspace tab in the background**. The current tab stays in front; the user is not redirected.
- **Right-click** on an in-app link shows a small menu: **Open in new tab**. Same background behavior. The native “open in new browser tab” path is blocked for same-origin app links so it cannot bypass the workspace.

Duplicate tabs are allowed (two Pikachu tabs, two Compare tabs with different `ids`).

The **+** control sits immediately after the last tab (not at the far right of the window). It opens a new tab at the Dex (`/`) and **switches to it**. Ctrl/Cmd/middle-click and “Open in new tab” still open in the background.

### What can be a tab

Any app route: Dex, Moves, move hub, Form, Compare, Type hub, Teams, Settings.

### Closing

Each tab has an ×. Middle-click on a tab chrome (the tab itself, not the page) also closes it.

There is always at least one tab. Closing the last tab resets it to Dex and clears that tab’s history stack.

Closing the active tab focuses the neighbor to the right, or the left if there is no right neighbor.

Tabs are not written to `localStorage`. Closing the browser window drops them.

### Titles

The strip shows a short label derived from the tab’s current location (Dex, form name when the dataset is loaded, move name, Compare, etc.).

### Browser Back / Forward

Each workspace tab has its own stack of locations.

- **Back** moves `index` backward on the **active** tab and updates the URL to that entry. Switching tabs does **not** push a browser history entry.
- If the active tab is already at the start of its stack, Back is a no-op (the user stays in the app).
- In-app “← Back” buttons use this same stack; if the stack cannot go back, they navigate the current tab to Dex (`/`).

Implementation constraint: the window history is not a second source of truth. Router navigations are recorded on the active tab’s stack; `history.push` is coerced to `replace` so tab switches and in-tab navigation do not interleave other tabs onto the browser stack. A one-entry “trap” re-captures `popstate` so Back/Forward apply to the active tab only.

Heuristic when the router updates without an explicit workspace action: **same pathname** (including search-only changes such as Dex filters or `?tab=sets`) **replaces** the current stack entry; **pathname change** **pushes** a new entry.

### URL

The address bar always reflects the **active** tab’s current location so a Form or Compare link can still be copied.

### Sidebar

Plain click on Dex / Moves / Compare / Teams / Settings navigates the **current** tab. Ctrl/Cmd/middle/right-click uses the same new-tab rules as any other link.

The sidebar “active” highlight follows the active tab’s pathname.

## Architecture

- Pure functions own tab list, active id, and per-tab stacks (`src/lib/workspace/state.ts`).
- `WorkspaceProvider` sits on the root route (inside `RouterProvider`), subscribes to the router, intercepts modified clicks / context menu on same-origin anchors, and owns the Back trap.
- `TabBar` renders above the page `Outlet` in `Shell`.
- Existing `Link` components keep working for unmodified clicks. Rows that are not anchors (Dex name, Moves row, palette results, Compare action) must honor the same modifiers.

## Tests

Unit tests cover the reducer: push/replace, open/insert, activate, close (including last tab), back/forward no-ops, cycle not required.

## Success

A user can keep Dex in one tab, open Form X in a second tab with Ctrl+click, Form Y in a third, and Compare in a fourth, switch between them without losing the others, and use browser Back only inside the tab that is in front.
