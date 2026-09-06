import * as React from "react"
import { useRouter } from "@tanstack/react-router"
import { useI18n } from "@/lib/i18n"
import {
  activateTab,
  canGoBack,
  closeTab,
  createInitialState,
  currentLocation,
  goBack,
  hrefOf,
  openTab,
  parseWorkspaceSnapshot,
  replaceInTab,
  resolveHistoryNavigation,
  serializeWorkspace,
  snapshotFromHref,
  snapshotFromRouter,
  WORKSPACE_STORAGE_KEY,
  type LocationSnapshot,
  type TraverseCause,
  type WorkspaceState,
} from "./state"

type WorkspaceApi = {
  tabs: WorkspaceState["tabs"]
  activeId: string
  current: LocationSnapshot
  activate: (id: string) => void
  close: (id: string) => void
  openInNewTab: (loc: LocationSnapshot) => void
  openLinkMenu: (x: number, y: number, loc: LocationSnapshot) => void
  newTab: () => void
  back: (fallback?: LocationSnapshot) => void
  canBack: boolean
}

const WorkspaceContext = React.createContext<WorkspaceApi | null>(null)

export function useWorkspace(): WorkspaceApi {
  const ctx = React.useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace outside WorkspaceProvider")
  return ctx
}

function snapshotFromUnknownLocation(location: {
  pathname: string
  href?: string
  searchStr?: string
}): LocationSnapshot {
  if (typeof location.searchStr === "string") {
    return snapshotFromRouter(location.pathname, location.searchStr)
  }
  if (typeof location.href === "string") {
    const href = location.href.startsWith("http") ? location.href : `http://workspace.local${location.href}`
    const parsed = snapshotFromHref(href)
    return { pathname: location.pathname || parsed.pathname, search: parsed.search }
  }
  return { pathname: location.pathname, search: "" }
}

function internalAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  const a = target.closest("a")
  if (!a || !a.getAttribute("href")) return null
  if (a.target === "_blank" || a.hasAttribute("download")) return null
  let url: URL
  try {
    url = new URL(a.href)
  } catch {
    return null
  }
  if (url.origin !== window.location.origin) return null
  return a
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { t } = useI18n()
  const [state, setState] = React.useState<WorkspaceState>(() => {
    const fallback = snapshotFromUnknownLocation(router.state.location)
    try {
      return parseWorkspaceSnapshot(localStorage.getItem(WORKSPACE_STORAGE_KEY), fallback) ?? createInitialState(fallback)
    } catch {
      return createInitialState(fallback)
    }
  })
  const stateRef = React.useRef(state)
  const [menu, setMenu] = React.useState<{ x: number; y: number; loc: LocationSnapshot } | null>(null)
  const restoredNav = React.useRef(false)
  // Last raw history action (PUSH/REPLACE from clicks, BACK/FORWARD from
  // native traversals such as Mouse4). Recorded synchronously on notify, read
  // later when the matching navigation resolves.
  const historyActionRef = React.useRef<{ type: string; delta?: number }>({ type: "REPLACE" })

  React.useEffect(() => {
    return router.history.subscribe((evt) => {
      const action = (evt as unknown as { action?: { type?: unknown; index?: unknown } }).action
      if (action && typeof action.type === "string") {
        historyActionRef.current = {
          type: action.type,
          delta: typeof action.index === "number" ? action.index : undefined,
        }
      }
    })
  }, [router])

  // Pushes a trap entry holding the current URL so the next native Back
  // (Mouse4) always produces a trappable pop instead of leaving the app.
  // Same-URL, so the onResolved subscription below ignores it.
  const pushTrap = React.useCallback(() => {
    try {
      router.history.push(hrefOf(currentLocation(stateRef.current!)))
    } catch {}
  }, [router])

  // Browser-like session restore: on first mount, navigate to the restored
  // active tab, then trap the first Back. Both target the current location,
  // so the onResolved subscription below ignores them.
  React.useEffect(() => {
    if (restoredNav.current) return
    restoredNav.current = true
    const s = stateRef.current!
    const href = hrefOf(currentLocation(s))
    const searchStr = router.state.location.searchStr ?? ""
    const cur = router.state.location.pathname + (searchStr === "?" ? "" : searchStr)
    if (cur !== href) router.history.replace(href)
    pushTrap()
  }, [router, pushTrap])

  // Persist every workspace change so closing the app keeps all tabs.
  // A failure keeps the previous snapshot (setItem is atomic); warn so a
  // silently stale restore is diagnosable.
  React.useEffect(() => {
    try {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspace(state))
    } catch (e) {
      console.warn("[workspace] persist failed", e)
    }
  }, [state])

  React.useEffect(() => {
    stateRef.current = state
  }, [state])

  const apply = React.useCallback((next: WorkspaceState, navigate: boolean) => {
    setState(next)
    stateRef.current = next
    if (!navigate) return
    router.history.replace(hrefOf(currentLocation(next)))
  }, [router])

  const openInNewTab = React.useCallback(
    (loc: LocationSnapshot) => {
      const s = stateRef.current!
      apply(openTab(s, loc), false)
    },
    [apply],
  )

  const activate = React.useCallback(
    (id: string) => {
      const s = stateRef.current!
      if (s.activeId === id) return
      apply(activateTab(s, id), true)
    },
    [apply],
  )

  const close = React.useCallback(
    (id: string) => {
      const s = stateRef.current!
      const next = closeTab(s, id, { pathname: "/", search: "" })
      const needNav = next.activeId !== s.activeId || hrefOf(currentLocation(next)) !== hrefOf(currentLocation(s))
      apply(next, needNav)
    },
    [apply],
  )

  const newTab = React.useCallback(() => {
    const s = stateRef.current!
    apply(openTab(s, { pathname: "/", search: "" }, true), true)
  }, [apply])

  const openLinkMenu = React.useCallback((x: number, y: number, loc: LocationSnapshot) => {
    setMenu({ x, y, loc })
  }, [])

  const back = React.useCallback((fallback?: LocationSnapshot) => {
    const s = stateRef.current!
    if (canGoBack(s)) {
      apply(goBack(s), true)
      return
    }
    apply(replaceInTab(s, fallback ?? { pathname: "/", search: "" }), true)
  }, [apply])

  React.useEffect(() => {
    const unsub = router.subscribe("onResolved", (evt: { fromLocation?: { pathname: string; href?: string; searchStr?: string } }) => {
      const s = stateRef.current
      const to = snapshotFromUnknownLocation(router.state.location)
      const from = evt.fromLocation ? snapshotFromUnknownLocation(evt.fromLocation) : currentLocation(s)
      const raw = historyActionRef.current
      // Programmatic navigations (tab switch, in-app back, close, restore)
      // always target the already-current location: ignore them here.
      if (hrefOf(to) === hrefOf(currentLocation(s)) || hrefOf(from) === hrefOf(to)) return
      // GO carries a relative delta as `index` (verified against
      // @tanstack/history 1.162.1: SubscriberArgs action { type, index: delta }).
      const cause: TraverseCause =
        raw.type === "BACK" ? "traverse-back"
        : raw.type === "FORWARD" || (raw.type === "GO" && (raw.delta ?? -1) > 0) ? "traverse-forward"
        : raw.type === "GO" ? "traverse-back"
        : "navigate"
      const res = resolveHistoryNavigation(s, from, to, cause)
      if (res.state) {
        setState(res.state)
        stateRef.current = res.state
      }
      if (res.navigateHref) {
        // The traversal landed somewhere the workspace does not track (stale
        // bottom-of-stack entry): hold the workspace view and re-trap.
        router.history.replace(res.navigateHref)
        pushTrap()
      }
    })
    return unsub
  }, [router, pushTrap])

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = internalAnchor(e.target)
      if (!a) return
      if (a.dataset.nav !== undefined && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        const href = a.getAttribute("href")
        // Real push (not replace) so native Back traverses in-app pages.
        if (href) router.history.push(href)
        return
      }
      if (e.button === 1 || e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()
        openInNewTab(snapshotFromHref(a.href))
      }
    }
    const onAux = (e: MouseEvent) => {
      const a = internalAnchor(e.target)
      if (!a) return
      if (e.button === 1) {
        e.preventDefault()
        e.stopPropagation()
        openInNewTab(snapshotFromHref(a.href))
      }
    }
    const onContext = (e: MouseEvent) => {
      const a = internalAnchor(e.target)
      if (!a) return
      e.preventDefault()
      setMenu({ x: e.clientX, y: e.clientY, loc: snapshotFromHref(a.href) })
    }
    document.addEventListener("click", onClick, true)
    document.addEventListener("auxclick", onAux, true)
    document.addEventListener("contextmenu", onContext, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("auxclick", onAux, true)
      document.removeEventListener("contextmenu", onContext, true)
    }
  }, [openInNewTab, router])

  const value = React.useMemo<WorkspaceApi>(
    () => ({
      tabs: state.tabs,
      activeId: state.activeId,
      current: currentLocation(state),
      activate,
      close,
      openInNewTab,
      openLinkMenu,
      newTab,
      back,
      canBack: canGoBack(state),
    }),
    [state, activate, close, openInNewTab, openLinkMenu, newTab, back],
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      {menu ? (
        <>
          <button type="button" className="fixed inset-0 z-[60] cursor-default bg-transparent" aria-label={t("workspace.dismissMenu")} onClick={() => setMenu(null)} />
          <div
            role="menu"
            className="fixed z-[61] min-w-[180px] rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] py-1 shadow-lg"
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--ds-gray-100)]"
              onClick={() => {
                openInNewTab(menu.loc)
                setMenu(null)
              }}
            >
              {t("workspace.openInNewTab")}
            </button>
          </div>
        </>
      ) : null}
    </WorkspaceContext.Provider>
  )
}
