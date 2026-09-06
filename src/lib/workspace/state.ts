export type LocationSnapshot = {
  pathname: string
  search: string
}

export type WorkspaceTab = {
  id: string
  entries: LocationSnapshot[]
  index: number
}

export type WorkspaceState = {
  tabs: WorkspaceTab[]
  activeId: string
  seq: number
}

export function hrefOf(loc: LocationSnapshot): string {
  return `${loc.pathname}${loc.search}`
}

export function snapshotsEqual(a: LocationSnapshot, b: LocationSnapshot): boolean {
  return a.pathname === b.pathname && a.search === b.search
}

export function snapshotFromHref(href: string): LocationSnapshot {
  const url = new URL(href, "http://workspace.local")
  return { pathname: url.pathname, search: url.search }
}

export function snapshotFromRouter(pathname: string, searchStr: string): LocationSnapshot {
  const search = searchStr === "?" ? "" : searchStr
  return { pathname, search }
}

function activeTab(state: WorkspaceState): WorkspaceTab {
  const tab = state.tabs.find((t) => t.id === state.activeId)
  if (!tab) throw new Error(`workspace: missing tab ${state.activeId}`)
  return tab
}

function withActive(state: WorkspaceState, tab: WorkspaceTab): WorkspaceState {
  return { ...state, tabs: state.tabs.map((t) => (t.id === tab.id ? tab : t)) }
}

export function currentLocation(state: WorkspaceState): LocationSnapshot {
  const tab = activeTab(state)
  return tab.entries[tab.index]!
}

export function createInitialState(loc: LocationSnapshot): WorkspaceState {
  const id = "tab-1"
  return {
    tabs: [{ id, entries: [loc], index: 0 }],
    activeId: id,
    seq: 1,
  }
}

export function pushInTab(state: WorkspaceState, loc: LocationSnapshot): WorkspaceState {
  const tab = activeTab(state)
  const cur = tab.entries[tab.index]!
  if (snapshotsEqual(cur, loc)) return state
  const entries = [...tab.entries.slice(0, tab.index + 1), loc]
  return withActive(state, { ...tab, entries, index: entries.length - 1 })
}

export function replaceInTab(state: WorkspaceState, loc: LocationSnapshot): WorkspaceState {
  const tab = activeTab(state)
  const entries = tab.entries.slice()
  entries[tab.index] = loc
  return withActive(state, { ...tab, entries })
}

export function openTab(state: WorkspaceState, loc: LocationSnapshot, focus = false): WorkspaceState {
  const id = `tab-${state.seq + 1}`
  const tab: WorkspaceTab = { id, entries: [loc], index: 0 }
  const i = state.tabs.findIndex((t) => t.id === state.activeId)
  const tabs = [...state.tabs.slice(0, i + 1), tab, ...state.tabs.slice(i + 1)]
  return { tabs, activeId: focus ? id : state.activeId, seq: state.seq + 1 }
}

export function activateTab(state: WorkspaceState, id: string): WorkspaceState {
  if (!state.tabs.some((t) => t.id === id)) return state
  return { ...state, activeId: id }
}

export function closeTab(state: WorkspaceState, id: string, fallback: LocationSnapshot): WorkspaceState {
  const closing = state.tabs.find((t) => t.id === id)
  if (!closing) return state

  if (state.tabs.length === 1) {
    return {
      ...state,
      tabs: [{ id: closing.id, entries: [fallback], index: 0 }],
      activeId: closing.id,
    }
  }

  const i = state.tabs.findIndex((t) => t.id === id)
  const tabs = state.tabs.filter((t) => t.id !== id)
  if (state.activeId !== id) return { ...state, tabs }

  const neighbor = tabs[i] ?? tabs[i - 1]!
  return { ...state, tabs, activeId: neighbor.id }
}

export function goBack(state: WorkspaceState): WorkspaceState {
  const tab = activeTab(state)
  if (tab.index === 0) return state
  return withActive(state, { ...tab, index: tab.index - 1 })
}

export type JumpTarget = { tabId: string; index: number }

/**
 * Finds an entry by href across all tabs. The active tab wins ties; within a
 * tab the pick favors the given traversal direction so a Back lands behind
 * the current entry and a Forward lands ahead of it.
 */
export function findHref(
  state: WorkspaceState,
  href: string,
  direction: "back" | "forward" | "any",
): JumpTarget | null {
  let best: JumpTarget | null = null
  for (const tab of state.tabs) {
    const hits: number[] = []
    tab.entries.forEach((e, i) => {
      if (hrefOf(e) === href) hits.push(i)
    })
    if (hits.length === 0) continue
    let pick: number
    if (direction === "back") {
      const behind = hits.filter((i) => i < tab.index)
      pick = behind.length > 0 ? Math.max(...behind) : Math.min(...hits)
    } else if (direction === "forward") {
      const ahead = hits.filter((i) => i > tab.index)
      pick = ahead.length > 0 ? Math.min(...ahead) : Math.max(...hits)
    } else {
      pick = hits.reduce((a, b) => (Math.abs(b - tab.index) < Math.abs(a - tab.index) ? b : a))
    }
    if (!best || (best.tabId !== state.activeId && tab.id === state.activeId)) {
      best = { tabId: tab.id, index: pick }
    }
  }
  return best
}

export function jumpToEntry(state: WorkspaceState, tabId: string, index: number): WorkspaceState {
  const tab = state.tabs.find((t) => t.id === tabId)
  if (!tab) return state
  if (!Number.isInteger(index) || index < 0 || index >= tab.entries.length) return state
  if (state.activeId === tabId && tab.index === index) return state
  return {
    ...state,
    activeId: tabId,
    tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, index } : t)),
  }
}

export type TraverseCause = "navigate" | "traverse-back" | "traverse-forward"

export type ResolvedNavigation = {
  /** New workspace state, or null when nothing changes. */
  state: WorkspaceState | null
  /**
   * Href the router must be pointed at, or null when the URL already matches.
   * Set when the native traversal landed somewhere the workspace does not
   * track (stale bottom-of-stack entry): the provider replaces the URL and
   * pushes a fresh trap entry so the next Back is trappable again.
   */
  navigateHref: string | null
}

/**
 * Pure decision for a router navigation the workspace did not initiate
 * (link click, palette, or a native Back/Forward traversal such as Mouse4).
 * Programmatic navigations (tab switch, in-app back, close) always target the
 * already-current location and are filtered by the caller before reaching here.
 */
export function resolveHistoryNavigation(
  state: WorkspaceState,
  from: LocationSnapshot,
  to: LocationSnapshot,
  cause: TraverseCause,
): ResolvedNavigation {
  if (snapshotsEqual(to, currentLocation(state))) return { state: null, navigateHref: null }
  if (cause === "navigate") {
    return {
      state: from.pathname === to.pathname ? replaceInTab(state, to) : pushInTab(state, to),
      navigateHref: null,
    }
  }
  const direction = cause === "traverse-forward" ? "forward" : "back"
  const found = findHref(state, hrefOf(to), direction)
  if (found) return { state: jumpToEntry(state, found.tabId, found.index), navigateHref: null }
  const tab = activeTab(state)
  if (direction === "back" && tab.index > 0) {
    const next = goBack(state)
    return { state: next, navigateHref: hrefOf(currentLocation(next)) }
  }
  if (direction === "forward" && tab.index < tab.entries.length - 1) {
    const next = goForward(state)
    return { state: next, navigateHref: hrefOf(currentLocation(next)) }
  }
  // Below everything the workspace tracks: hold the current view and re-trap.
  return { state: null, navigateHref: hrefOf(currentLocation(state)) }
}

export function goForward(state: WorkspaceState): WorkspaceState {
  const tab = activeTab(state)
  if (tab.index >= tab.entries.length - 1) return state
  return withActive(state, { ...tab, index: tab.index + 1 })
}

export function canGoBack(state: WorkspaceState): boolean {
  return activeTab(state).index > 0
}

export function canGoForward(state: WorkspaceState): boolean {
  const tab = activeTab(state)
  return tab.index < tab.entries.length - 1
}

export function searchToRecord(search: string): Record<string, string> | undefined {
  if (!search || search === "?") return undefined
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  const o: Record<string, string> = {}
  p.forEach((v, k) => {
    o[k] = v
  })
  return Object.keys(o).length ? o : undefined
}

// Browser-like session restore: the tab strip (routes + search, i.e. the
// Dex/Moves filters and the Compare selection) persists across restarts.
export const WORKSPACE_STORAGE_KEY = "pokestats:workspace:v1"
const WORKSPACE_STORAGE_VERSION = 1
const MAX_TABS = 25
const MAX_ENTRIES = 50
const MAX_SEARCH_LENGTH = 2000

const KNOWN_PREFIXES = ["/", "/compare", "/moves", "/types", "/items", "/natures", "/teams", "/settings", "/favorites", "/form"]

function isValidPathname(pathname: unknown): pathname is string {
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.includes(" ") || pathname.includes("\n")) return false
  return KNOWN_PREFIXES.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)))
}

function isValidSearch(search: unknown): search is string {
  if (typeof search !== "string") return false
  if (search !== "" && !search.startsWith("?")) return false
  return search.length <= MAX_SEARCH_LENGTH
}

function parseEntry(raw: unknown): LocationSnapshot | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (!isValidPathname(o.pathname) || !isValidSearch(o.search)) return null
  return { pathname: o.pathname, search: o.search }
}

export function serializeWorkspace(state: WorkspaceState): string {
  return JSON.stringify({
    v: WORKSPACE_STORAGE_VERSION,
    activeId: state.activeId,
    seq: state.seq,
    tabs: state.tabs.map((t) => ({ id: t.id, index: t.index, entries: t.entries })),
  })
}

/**
 * Parses a persisted workspace snapshot. Returns null when there is nothing
 * usable (missing/corrupt/empty), so the caller falls back to a fresh tab.
 * Never throws.
 */
export function parseWorkspaceSnapshot(raw: string | null, fallback: LocationSnapshot): WorkspaceState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return null
    const o = parsed as Record<string, unknown>
    if (o.v !== WORKSPACE_STORAGE_VERSION || !Array.isArray(o.tabs)) return null
    const tabs: WorkspaceTab[] = []
    const seen = new Set<string>()
    for (const row of o.tabs.slice(0, MAX_TABS)) {
      if (!row || typeof row !== "object") continue
      const r = row as Record<string, unknown>
      if (typeof r.id !== "string" || r.id.length === 0 || seen.has(r.id)) continue
      if (!Array.isArray(r.entries)) continue
      const entries = r.entries
        .slice(-MAX_ENTRIES)
        .map(parseEntry)
        .filter((e): e is LocationSnapshot => e !== null)
      if (entries.length === 0) continue
      const index = typeof r.index === "number" && Number.isInteger(r.index) ? Math.min(Math.max(r.index, 0), entries.length - 1) : entries.length - 1
      seen.add(r.id)
      tabs.push({ id: r.id, entries, index })
    }
    if (tabs.length === 0) return null
    const activeId = typeof o.activeId === "string" && tabs.some((t) => t.id === o.activeId) ? o.activeId : tabs[0]!.id
    // seq must stay ahead of every numeric tab id so reopened tabs never collide.
    let seq = typeof o.seq === "number" && Number.isFinite(o.seq) ? Math.floor(o.seq) : tabs.length
    for (const t of tabs) {
      const n = /^tab-(\d+)$/.exec(t.id)?.[1]
      if (n !== undefined) seq = Math.max(seq, Number(n))
    }
    seq = Math.max(seq, tabs.length)
    void fallback
    return { tabs, activeId, seq }
  } catch {
    return null
  }
}
