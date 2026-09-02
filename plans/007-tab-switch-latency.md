# Plan 007: Make tab switches feel instant — prewarmed route chunks, jump-free scroll restore, no per-frame storage writes, O(1) lookups on remount

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0b6331f..HEAD -- src/App.tsx src/routes/dex.tsx src/routes/moves.tsx src/routes/items.tsx src/routes/formDetail.tsx src/components/layout/TabBar.tsx src/lib/dataset/load.ts src/lib/dataset/load.test.ts src/lib/domain/dexFilter.ts`
> This plan was written against an **uncommitted working tree** on top of
> `0b6331f`, and **after Plan 006** is expected to have changed `dex.tsx` /
> `moves.tsx` rows. Compare every "Current state" excerpt against the live
> code before proceeding; on a mismatch that is *not* explained by Plan 006
> (rows extracted to `DexRow`/`MoveRow`, `sortForms`/`collapseSpecies` in
> `dexFilter.ts`), treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/006-list-rows-render-cost.md` (Step 3 caches the
  `sortForms` result that 006 introduces; Steps 1, 2, 4, 5 do not depend on it)
- **Category**: perf
- **Planned at**: working tree over commit `0b6331f`, 2026-09-01

## Why this matters

A workspace tab switch is a router navigation: the previous page unmounts and
the next one mounts from scratch. What the user sees and why:

1. **A skeleton flash** on the first visit to each page: most routes are
   `React.lazy` and the chunk is fetched over the asset protocol only when the
   route is first rendered (`src/App.tsx:17-28`). Nothing prewarms them.
2. **A visible jump**: the virtualized lists restore their scroll position with
   a double `requestAnimationFrame` after mount (`dex.tsx:254`, `moves.tsx:259`,
   `items.tsx:100`) — two frames at the top, then a jump to the saved offset.
3. **Redundant work per mount**: Dex re-sorts ~1,380 Forms (after Plan 006 the
   sort is the only remaining heavy step); Form detail filters the whole
   `sets.sets` array on every render (`formDetail.tsx:138`); the Moves
   "learners" sort slugifies move names inside the comparator
   (`moves.tsx:213-223`); the tab bar finds a move by slugging every move name
   for each Move tab (`TabBar.tsx:35`).
4. **Per-frame storage writes**: the list scrollers write `sessionStorage` on
   every scroll event (three places).

Each is small; together they are the difference between "the tab is already
there" and "the tab loads". Keep-alive of inactive tabs (rendering all tabs and
hiding inactive ones) was considered and **rejected for now**: the pages read
route state through TanStack hooks (`useSearch({ from })`, params), so a
hidden tab would read the active route's state. React 19.2's `<Activity>` makes
the DOM side easy but the router coupling remains; revisit only if this plan
is not enough.

## Current state

- `src/App.tsx:17-28` — eleven `React.lazy(() => import("@/routes/…"))`
  declarations; the `App` effect (188–199) logs `[perf] first paint` and
  `[perf] route -> <path>` on `router.subscribe("onResolved", …)`.

- `src/routes/dex.tsx` scroll save/restore:

```244:264:src/routes/dex.tsx
  const restoredRef = React.useRef(false)
  React.useEffect(() => {
    const el = parentRef.current
    if (!el) return
    if (!restoredRef.current && !loading) {
      restoredRef.current = true
      const raw = sessionStorage.getItem(SCROLL_KEY)
      const top = raw === null ? NaN : Number(raw)
      if (!Number.isNaN(top)) {
        // double rAF: let the virtualizer lay out rows before jumping
        requestAnimationFrame(() => requestAnimationFrame(() => { el.scrollTop = top }))
      }
    }
    const onScroll = () => sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop))
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [loading])
  const saveScroll = React.useCallback(() => {
    const el = parentRef.current
    if (el) sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop))
  }, [])
```

  `useVirtualizer` at 233–238: `{ count, getScrollElement, estimateSize: () => 36, overscan: 10 }`.
  `SCROLL_KEY = "dex:scrollTop"` (line 33). `moves.tsx:247-269` and
  `items.tsx:90-106` are the same pattern with their own keys, gated on
  `!loading && catalogReady`.

- `@tanstack/react-virtual` 3.14.10 / `virtual-core` 3.17.8 — `useVirtualizer`
  accepts `initialOffset?: number | (() => number)` (verified in
  `node_modules/.pnpm/@tanstack+virtual-core@3.17.8/.../index.d.ts:72`).

- `src/routes/formDetail.tsx`:

```138:145:src/routes/formDetail.tsx
  const sets = data.sets.sets.filter((s) => s.formId === form.id)
  const gens = [...new Set(sets.map((s) => s.dexGen))].sort()
  const fmts = [...new Set(sets.map((s) => s.formatId))].sort()
  const filteredSets = sets.filter((s) => {
    if (filterGen !== "all" && s.dexGen !== filterGen) return false
    if (filterFmt !== "all" && s.formatId !== filterFmt) return false
    return true
  })
```

- `src/routes/moves.tsx:206-236` — `filtered` memo; the comparator calls
  `learnersOf(a.name)` → `learnsets?.[moveIdForName(name)]?.length ?? 0`
  (`toSlug` per call). Rows compute `moveIdForName(m.name)` again (368–369).

- `src/components/layout/TabBar.tsx`:

```32:36:src/components/layout/TabBar.tsx
  const moveMatch = loc.pathname.match(/^\/moves\/([^/]+)$/)
  if (moveMatch) {
    const id = decodeURIComponent(moveMatch[1]!)
    const found = data?.core.moves.find((m) => moveIdForName(m.name) === id)
    return { label: found?.name ?? fallback, glyph: <span className="text-[13px] leading-none opacity-80">✦</span> }
  }
```

  `LoadedDataset.movesById` is `Map<slug, MoveInfo>` (`load.ts:33`, built with
  `toSlug(m.name)` in `applyCatalog`). `moveIdForName` (`load.ts:332-336`) is
  `toSlug` except that every `hiddenpower*` collapses to `"hiddenpower"`.

- `src/lib/dataset/load.ts:129-136` — `withExtras(indexed, sets, learnsets, extrasReady)` returns
  `{ ...indexed, sets, learnsets, extrasReady }`. `LoadedDataset` type at 18–38.

- `src/lib/domain/dexFilter.ts` — after Plan 006 exports `sortForms(forms, sortBy, dir)`.

Conventions: hooks live in `src/hooks/*.ts` (`useDataset.ts` is the exemplar:
a default-less named export, `React.*` namespace). Tests: vitest, node env,
inline fixtures (`src/lib/dataset/load.test.ts`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm exec tsc -b --pretty false` | exit 0 |
| Tests | `pnpm test` | all pass |
| Lint | `pnpm lint` | exit 0 |
| Dev server | `pnpm dev` | http://localhost:1420 |
| Ship gate | `powershell -ExecutionPolicy Bypass -File .\release.ps1` | exit 0 + artifact list |

## Scope

**In scope**:

- `src/App.tsx` (prewarm + one perf log)
- `src/hooks/useRestoredScroll.ts` (create)
- `src/routes/dex.tsx`, `src/routes/moves.tsx`, `src/routes/items.tsx` (scroll hook; moves: moveId map)
- `src/routes/formDetail.tsx` (use the index)
- `src/components/layout/TabBar.tsx` (movesById lookup)
- `src/lib/dataset/load.ts`, `src/lib/dataset/load.test.ts` (`setsByFormId`)
- `src/lib/domain/dexFilter.ts`, `src/lib/domain/dexFilter.test.ts` (cached sort)
- `plans/README.md`

**Out of scope**:

- Keep-alive / `<Activity>` for tabs (see "Why this matters").
- `src/lib/workspace/*` — tab model unchanged.
- `src/routes/itemDetail.tsx`, `src/lib/domain/items.ts` set scans — cold paths.
- Row markup (Plan 006).

## Git workflow

- Branch: `advisor/007-tab-switch-latency`.
- Suggested commits: `perf(app): prewarm route chunks at idle`,
  `perf(lists): restore scroll on first frame; write position on scrollend`,
  `perf(dataset): index sets by formId; cache dex sort per forms/sort key`,
  `perf(tabs): O(1) move tab labels`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Prewarm route chunks after boot

In `src/App.tsx`, next to the lazy declarations, collect the same importers:

```ts
const ROUTE_CHUNKS: Array<() => Promise<unknown>> = [
  () => import("@/routes/moves"),
  () => import("@/routes/types"),
  () => import("@/routes/items"),
  () => import("@/routes/natures"),
  () => import("@/routes/formDetail"),
  () => import("@/routes/moveDetail"),
  () => import("@/routes/typeDetail"),
  () => import("@/routes/itemDetail"),
  () => import("@/routes/compare"),
  () => import("@/routes/teams"),
  () => import("@/routes/favorites"),
  () => import("@/routes/settings"),
]

function prewarmRouteChunks(): void {
  const run = () => {
    for (const load of ROUTE_CHUNKS) void load().catch(() => {})
  }
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(run, { timeout: 4000 })
  else window.setTimeout(run, 1500)
}
```

Call `prewarmRouteChunks()` from the `App` effect **after** the dataset is
ready so it never competes with `dex.json`: `void loadDataset().then(prewarmRouteChunks)`
(import `loadDataset` from `@/lib/dataset/load`; it returns the cached promise).

Also extend the existing `onResolved` log so a painted-frame time is visible:

```ts
console.log(`[perf] route -> ${to} @ ${performance.now().toFixed(1)}ms`)
requestAnimationFrame(() => console.log(`[perf] route painted ${to} @ ${performance.now().toFixed(1)}ms`))
```

Vite bundles each `import("@/routes/x")` to the same chunk the `React.lazy`
factory requests, so after prewarm the lazy factory resolves from the module
cache and TanStack's transition-based navigation shows no `PageFallback`.

**Verify**: `pnpm exec tsc -b --pretty false` → 0. `pnpm dev`, wait ~3 s on the
Dex, then open the Network panel and click the Moves tab: **no** new
`moves-*.js` request; the console shows `route ->` and `route painted` within
~1–2 frames (< 40 ms apart on a warm machine).

### Step 2: One shared, jump-free scroll restore hook

Create `src/hooks/useRestoredScroll.ts`:

```ts
import * as React from "react"

/**
 * Saved-offset restore for virtualized lists that own their own scroller.
 * - `initialOffset` feeds useVirtualizer so the first render already lays out
 *   the rows at the saved position (no double-rAF jump).
 * - The layout effect sets scrollTop before paint once `ready` is true.
 * - Position is persisted on `scrollend` (Chromium) or rAF-coalesced `scroll`.
 */
export function useRestoredScroll(
  ref: React.RefObject<HTMLElement | null>,
  key: string,
  ready: boolean,
): { initialOffset: number } {
  const initial = React.useRef<number | null>(null)
  if (initial.current === null) {
    const raw = sessionStorage.getItem(key)
    const n = raw === null ? 0 : Number(raw)
    initial.current = Number.isFinite(n) && n > 0 ? n : 0
  }
  const restored = React.useRef(false)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || !ready) return
    if (!restored.current) {
      restored.current = true
      if (initial.current) el.scrollTop = initial.current
    }
    const save = () => sessionStorage.setItem(key, String(el.scrollTop))
    if ("onscrollend" in window) {
      el.addEventListener("scrollend", save, { passive: true })
      return () => el.removeEventListener("scrollend", save)
    }
    let pending = false
    const onScroll = () => {
      if (pending) return
      pending = true
      requestAnimationFrame(() => {
        pending = false
        save()
      })
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [ref, key, ready])

  return { initialOffset: initial.current }
}
```

Apply in the three lists:

- `dex.tsx`: `const { initialOffset } = useRestoredScroll(parentRef, SCROLL_KEY, !loading)`;
  pass `initialOffset` into `useVirtualizer({ ..., initialOffset })`; delete the
  `restoredRef` effect block (lines 244–260) and `saveScroll` if unused after Plan 006.
- `moves.tsx`: same with `ready = !loading && catalogReady`.
- `items.tsx`: same with `ready = !loading && catalogReady`.

`parentRef` must be declared **before** the hook call (it already is in all
three files: `const parentRef = React.useRef<HTMLDivElement>(null)` precedes
`useVirtualizer`).

**Verify**: `pnpm exec tsc -b --pretty false` → 0; `pnpm lint` → 0. Manual in
`pnpm dev`: scroll the Dex to row ~300, switch to Moves, switch back → the
list is already at row ~300 on the first frame (record the screen or step
through with the Performance panel's screenshots: there must be no frame
showing row 1). Repeat for Moves and Items. `rg "requestAnimationFrame\(\(\) => requestAnimationFrame" src/routes` → no matches.

### Step 3: Cache the Dex sort across remounts (requires Plan 006)

In `src/lib/domain/dexFilter.ts` add a cache in front of `sortForms`:

```ts
const sortCache = new WeakMap<Form[], Map<string, Form[]>>()

/** sortForms with a per-forms-array memo: a remount with the same sort key returns the same array. */
export function sortFormsCached(forms: Form[], sortBy: DexSortKey, dir: "asc" | "desc"): Form[] {
  let byKey = sortCache.get(forms)
  if (!byKey) {
    byKey = new Map()
    sortCache.set(forms, byKey)
  }
  const key = `${sortBy}:${dir}`
  const hit = byKey.get(key)
  if (hit) return hit
  const out = sortForms(forms, sortBy, dir)
  byKey.set(key, out)
  return out
}
```

In `dex.tsx` use `sortFormsCached` in the `sorted` memo. The dataset's
`core.forms` array identity is stable for the app's lifetime (`indexDex` keeps
the parsed array; `applyCatalog`/`withExtras` spread `core` but reuse the same
`forms` array) — confirm with `rg "forms:" src/lib/dataset/load.ts` (no
re-mapping of `forms`).

Test in `dexFilter.test.ts`: two calls with the same `forms` array and key
return the **same reference**; a different key returns a different array; a
different `forms` array (copy) is not shared.

**Verify**: `pnpm test -- src/lib/domain/dexFilter.test.ts` → pass.

### Step 4: `setsByFormId` on the dataset; Form detail reads the index

`src/lib/dataset/load.ts`:

- Add `setsByFormId: Map<string, Set[]>` to `LoadedDataset` (import the `Set`
  type from `@/lib/domain/types` under an alias, e.g. `type SetEntry = DatasetSets["sets"][number]`,
  to avoid shadowing the global `Set`).
- In `withExtras`, build it:

```ts
const setsByFormId = new Map<string, SetEntry[]>()
for (const s of sets.sets) {
  const arr = setsByFormId.get(s.formId)
  if (arr) arr.push(s)
  else setsByFormId.set(s.formId, [s])
}
return { ...indexed, sets, learnsets, extrasReady, setsByFormId }
```

`src/routes/formDetail.tsx:138-145` → memoize on the index:

```ts
const sets = React.useMemo(() => data.setsByFormId.get(form.id) ?? [], [data, form.id])
const gens = React.useMemo(() => [...new Set(sets.map((s) => s.dexGen))].sort(), [sets])
const fmts = React.useMemo(() => [...new Set(sets.map((s) => s.formatId))].sort(), [sets])
const filteredSets = React.useMemo(
  () => sets.filter((s) => (filterGen === "all" || s.dexGen === filterGen) && (filterFmt === "all" || s.formatId === filterFmt)),
  [sets, filterGen, filterFmt],
)
```

If these lines sit **after** an early `return` in the component (line 126
returns when `form` is missing), hooks cannot be placed there — move the
memos above the early return and guard with `form?.id ?? ""`.

Test in `load.test.ts`: the existing "withExtras extrasReady true" case →
also `expect(full.setsByFormId.get("charizard")).toHaveLength(1)`; the
"extrasReady false" case → `expect(staged.setsByFormId.size).toBe(0)`.

**Verify**: `pnpm test` → pass. `pnpm exec tsc -b --pretty false` → 0.
`rg "sets.sets.filter\(\(s\) => s.formId" src/routes/formDetail.tsx` → no matches.

### Step 5: O(1) move ids in the Moves sort and in Move tabs

`src/routes/moves.tsx`: add `const moveIdOf = React.useMemo(() => new Map(moves.map((m) => [m.name, moveIdForName(m.name)] as const)), [moves])`.
Use `moveIdOf.get(name)!` in `learnersOf` and where rows compute `moveId`
(after Plan 006, in the parent when building `MoveRow` props).

`src/components/layout/TabBar.tsx:35`: replace the `find` with
`const found = data?.movesById.get(id)`. (`movesById` keys are `toSlug(name)`;
route ids come from `moveIdForName`, which equals `toSlug` for every move
except Hidden Power variants, whose id is the base `"hiddenpower"` — also a
`movesById` key. Same label as before in every case.)

**Verify**: `pnpm exec tsc -b --pretty false` → 0. Manual: open a Move from
the list → the tab shows the move name; sort Moves by learners after extras
load → same order as before (spot-check the top 5).

### Step 6: Ship gate

`release.ps1` → exit 0. On the release exe: switch between Dex, Moves, Types,
Items, Natures, Teams twice each — no skeleton after the first visit, lists
return to their scroll position without a jump.

## Test plan

- `src/lib/domain/dexFilter.test.ts`: `sortFormsCached` identity/miss cases (3).
- `src/lib/dataset/load.test.ts`: `setsByFormId` populated / empty (2 assertions in existing cases).
- No DOM tests (node env) — Steps 1, 2, 5 have manual checks.
- Verification: `pnpm test` → all pass.

## Done criteria

ALL must hold:

- [ ] `rg "prewarmRouteChunks" src/App.tsx` → 2 matches (definition + call)
- [ ] `src/hooks/useRestoredScroll.ts` exists; `rg "useRestoredScroll" src/routes` → 3 files
- [ ] `rg "requestAnimationFrame\(\(\) => requestAnimationFrame" src/routes` → no matches
- [ ] `rg "sessionStorage.setItem" src/routes` → no matches (only inside the hook)
- [ ] `rg "setsByFormId" src/lib/dataset/load.ts src/routes/formDetail.tsx` → matches in both
- [ ] `rg "core.moves.find" src/components/layout/TabBar.tsx` → no matches
- [ ] `rg "sortFormsCached" src/routes/dex.tsx` → 1 match (or Step 3 marked skipped in the status row because 006 had not landed)
- [ ] `pnpm exec tsc -b --pretty false` 0; `pnpm test` 0; `pnpm lint` 0
- [ ] `release.ps1` exit 0 with artifact list
- [ ] `git status` shows only in-scope files
- [ ] `plans/README.md` status row for 007 updated

## STOP conditions

- Excerpts drifted beyond what Plan 006 explains.
- After Step 2 the restored position is visibly wrong (lands on a different
  row than saved) on any of the three lists after one fix attempt — the likely
  cause is `initialOffset` being read before `sessionStorage` was written by
  the previous unmount; report with the sequence.
- `scrollend` never fires in the WebView (check with a `console.log` in
  `save`) — fall back to the rAF path unconditionally and report.
- Hooks-after-early-return in `formDetail.tsx` cannot be reordered without
  changing the missing-form UI — stop and report.
- Verification fails twice for the same step.

## Maintenance notes

- New lazy routes must be added to `ROUTE_CHUNKS` or they will flash a
  skeleton on first visit.
- Every virtualized list should use `useRestoredScroll`; do not reintroduce
  per-event `sessionStorage` writes.
- `setsByFormId` is built once per extras load; if Sets ever become mutable at
  runtime (user-defined sets), rebuild the index there.
- Reviewers: check that `useLayoutEffect` in the hook does not run on the
  server (`vitest` is node but never renders components; fine) and that the
  `ready` flag in each list matches the old gate (`!loading` for Dex,
  `!loading && catalogReady` for Moves/Items).
- Deferred: keep-alive with React 19.2 `<Activity>` — would need pages to read
  route state from props instead of `useSearch({ from })`. Only worth it if
  measured tab switches are still > 100 ms after this plan.
