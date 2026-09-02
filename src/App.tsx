import * as React from "react"
import { createRouter, RouterProvider, createRootRoute, createRoute, Outlet } from "@tanstack/react-router"
import { Shell } from "@/components/layout/Shell"
import { PageFallback } from "@/components/layout/PageFallback"
import { DexPage, type DexSearch } from "@/routes/dex"
import type { MovesSearch } from "@/routes/moves"
import type { TypesSearch } from "@/routes/types"
import type { ItemsSearch } from "@/routes/items"
import type { NaturesSearch } from "@/routes/natures"
import { I18nProvider } from "@/lib/i18n"
import { WorkspaceProvider } from "@/lib/workspace/WorkspaceProvider"
import { BookmarksProvider } from "@/lib/bookmarks/BookmarksProvider"
import { CobblemonEggProvider } from "@/lib/cobblemon/CobblemonEggProvider"

export type { DexSearch }

const ComparePage = React.lazy(() => import("@/routes/compare").then((m) => ({ default: m.ComparePage })))
const MovesPage = React.lazy(() => import("@/routes/moves").then((m) => ({ default: m.MovesPage })))
const MoveDetailPage = React.lazy(() => import("@/routes/moveDetail").then((m) => ({ default: m.MoveDetailPage })))
const TypesPage = React.lazy(() => import("@/routes/types").then((m) => ({ default: m.TypesPage })))
const TypeDetailPage = React.lazy(() => import("@/routes/typeDetail").then((m) => ({ default: m.TypeDetailPage })))
const ItemsPage = React.lazy(() => import("@/routes/items").then((m) => ({ default: m.ItemsPage })))
const ItemDetailPage = React.lazy(() => import("@/routes/itemDetail").then((m) => ({ default: m.ItemDetailPage })))
const NaturesPage = React.lazy(() => import("@/routes/natures").then((m) => ({ default: m.NaturesPage })))
const TeamsPage = React.lazy(() => import("@/routes/teams").then((m) => ({ default: m.TeamsPage })))
const SettingsPage = React.lazy(() => import("@/routes/settings").then((m) => ({ default: m.SettingsPage })))
const FavoritesPage = React.lazy(() => import("@/routes/favorites").then((m) => ({ default: m.FavoritesPage })))
const FormDetailPage = React.lazy(() => import("@/routes/formDetail").then((m) => ({ default: m.FormDetailPage })))
const CommandPalette = React.lazy(() => import("@/hooks/usePalette").then((m) => ({ default: m.CommandPalette })))

function DeferredPalette() {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 0)
    return () => window.clearTimeout(id)
  }, [])
  if (!ready) return null
  return (
    <React.Suspense fallback={null}>
      <CommandPalette />
    </React.Suspense>
  )
}

const rootRoute = createRootRoute({
  component: () => (
    <WorkspaceProvider>
      <BookmarksProvider>
        <CobblemonEggProvider>
          <Shell>
            <React.Suspense fallback={<PageFallback />}>
              <Outlet />
            </React.Suspense>
          </Shell>
          <DeferredPalette />
        </CobblemonEggProvider>
      </BookmarksProvider>
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
const typesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/types",
  validateSearch: (search: Record<string, unknown>): TypesSearch => ({
    t: typeof search.t === "string" ? search.t : undefined,
    view: typeof search.view === "string" ? search.view : undefined,
  }),
  component: TypesPage,
})
const typeDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/types/$typeId",
  component: TypeDetailPage,
})
const itemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/items",
  validateSearch: (search: Record<string, unknown>): ItemsSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
    kind: typeof search.kind === "string" ? search.kind : undefined,
    used: typeof search.used === "string" ? search.used : undefined,
  }),
  component: ItemsPage,
})
const itemDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/items/$itemId",
  component: ItemDetailPage,
})
const naturesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/natures",
  validateSearch: (search: Record<string, unknown>): NaturesSearch => ({
    n: typeof search.n === "string" ? search.n : undefined,
  }),
  component: NaturesPage,
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
const favoritesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/favorites", component: FavoritesPage })
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
  typesRoute,
  typeDetailRoute,
  itemsRoute,
  itemDetailRoute,
  naturesRoute,
  teamsRoute,
  settingsRoute,
  favoritesRoute,
  formRoute,
])
// Router restores window scroll everywhere except the virtualized lists (Dex
// "/", Moves "/moves"), whose inner scrollers own their own restoration
// (src/routes/dex.tsx, src/routes/moves.tsx) — the router's generic
// inner-element restore keys elements by generated CSS paths that collide
// across pages and corrupts the offset.
const VIRTUALIZED_LIST_ROUTES = ["/", "/moves", "/items"]
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
