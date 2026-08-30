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
