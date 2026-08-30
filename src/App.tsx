import * as React from "react"
import { createRouter, RouterProvider, createRootRoute, createRoute, Outlet } from "@tanstack/react-router"
import { Shell } from "@/components/layout/Shell"
import { DexPage } from "@/routes/dex"
import { MovesPage, type MovesSearch } from "@/routes/moves"
import { MoveDetailPage } from "@/routes/moveDetail"
import { TypeDetailPage } from "@/routes/typeDetail"
import { FormDetailPage } from "@/routes/formDetail"
import { ComparePage } from "@/routes/compare"
import { TeamsPage } from "@/routes/teams"
import { SettingsPage } from "@/routes/settings"
import { CommandPalette } from "@/hooks/usePalette"
import { I18nProvider } from "@/lib/i18n"
import { WorkspaceProvider } from "@/lib/workspace/WorkspaceProvider"

export type DexSearch = {
  q?: string
  trait?: string
  traits?: string
  type?: string
  types?: string
  mode?: string
  grouped?: string
  sort?: string
  dir?: string
}

const rootRoute = createRootRoute({
  component: () => (
    <WorkspaceProvider>
      <Shell>
        <Outlet />
      </Shell>
      <CommandPalette />
    </WorkspaceProvider>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>): DexSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
    trait: typeof search.trait === "string" ? search.trait : undefined,
    traits: typeof search.traits === "string" ? search.traits : undefined,
    type: typeof search.type === "string" ? search.type : undefined,
    types: typeof search.types === "string" ? search.types : undefined,
    mode: typeof search.mode === "string" ? search.mode : undefined,
    grouped: typeof search.grouped === "string" ? search.grouped : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    dir: typeof search.dir === "string" ? search.dir : undefined,
  }),
  component: DexPage,
})
const compareRoute = createRoute({ getParentRoute: () => rootRoute, path: "/compare", component: ComparePage })
const movesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/moves",
  validateSearch: (search: Record<string, unknown>): MovesSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
    type: typeof search.type === "string" ? search.type : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    dir: typeof search.dir === "string" ? search.dir : undefined,
  }),
  component: MovesPage,
})
const moveDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/moves/$moveId",
  component: MoveDetailPage,
})
const typeDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/types/$typeId",
  component: TypeDetailPage,
})
const teamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams",
  validateSearch: (search: Record<string, unknown>): { team?: string; tab?: string; mode?: string } => ({
    team: typeof search.team === "string" ? search.team : undefined,
    tab: typeof search.tab === "string" ? search.tab : undefined,
    mode: typeof search.mode === "string" ? search.mode : undefined,
  }),
  component: TeamsPage,
})
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage })
const formRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/form/$formId",
  component: FormDetailPage,
  validateSearch: (search: Record<string, unknown>): { tab?: "sets" } => {
    if (search.tab === "sets") return { tab: "sets" }
    return {}
  },
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  compareRoute,
  movesRoute,
  moveDetailRoute,
  typeDetailRoute,
  teamsRoute,
  settingsRoute,
  formRoute,
])
// Router restores window scroll everywhere except the virtualized lists (Dex
// "/", Moves "/moves"), whose inner scrollers own their own restoration
// (src/routes/dex.tsx, src/routes/moves.tsx) — the router's generic
// inner-element restore keys elements by generated CSS paths that collide
// across pages and corrupts the offset.
const VIRTUALIZED_LIST_ROUTES = ["/", "/moves"]
const router = createRouter({
  routeTree,
  scrollRestoration: ({ location }) => !VIRTUALIZED_LIST_ROUTES.includes(location.pathname),
})
router.history.push = router.history.replace.bind(router.history)

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

export function App() {
  React.useEffect(() => {
    const saved = localStorage.getItem("pokestats:theme") ?? "dark"
    document.documentElement.dataset.theme = saved
    document.documentElement.classList.toggle("dark", saved === "dark")
    console.log(`[perf] first paint ${performance.now().toFixed(1)}ms`)
    const unsub = router.subscribe("onResolved", (e) => {
      const to = (e as unknown as { toLocation?: { pathname?: string } }).toLocation?.pathname ?? "unknown"
      console.log(`[perf] route -> ${to} @ ${performance.now().toFixed(1)}ms`)
    })
    return () => unsub()
  }, [])

  return (
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>
  )
}
