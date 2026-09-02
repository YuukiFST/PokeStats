# Plan 006: Make Dex and Moves rows cheap — memoized rows, plain anchors, fade-free thumbs, O(1) bookmarks, sort-once-filter-many

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0b6331f..HEAD -- src/routes/dex.tsx src/routes/moves.tsx src/components/ui/sprite.tsx src/components/ui/badge.tsx src/lib/bookmarks/BookmarksProvider.tsx src/lib/bookmarks/store.ts src/lib/workspace/WorkspaceProvider.tsx src/lib/domain/dexFilter.ts src/lib/domain/dexFilter.test.ts`
> This plan was written against an **uncommitted working tree** on top of
> `0b6331f`. Compare every "Current state" excerpt below against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches the two hottest screens; behavior must stay identical)
- **Depends on**: none (independent of 004/005; can run in parallel)
- **Category**: perf
- **Planned at**: working tree over commit `0b6331f`, 2026-09-01

## Why this matters

Typing in the Dex search, scrolling, starring a row, and every tab switch
re-render the visible rows of the virtualized lists. Each Dex row today costs
far more than its pixels:

- Rows are inline JSX in the parent `map` — **not memoized** — so every parent
  render (each keystroke, each bookmark toggle, each dataset notify) rebuilds
  all ~30–45 visible rows.
- Each row mounts a TanStack `<Link>` for the name plus one `<Link>` per type
  chip (`LinkedTypeBadge`). `useLinkProps` runs ~8 hooks and subscribes to the
  router's location store; on **every location change** (each settled
  keystroke navigates with `replace: true`) every mounted Link re-runs
  `router.buildLocation(...)`. That is ~100+ `buildLocation` calls per keystroke
  before the list itself re-renders.
- Each `SpriteThumb` subscribes to the whole dataset (`useDataset()` inside
  `useBaseFallback`), holds four `useState`s, uses `loading="lazy"` (pointless
  in a virtualized list — the browser adds its own delay) and **fades in over
  180 ms on every mount** — so every scroll and every tab switch shows sprites
  "loading" even when they are already cached.
- `useBookmarks().has()` is `items.some(...)` with a `bookmarkKey` per element,
  called twice per row; toggling one star swaps the provider value and
  re-renders the whole page.
- The Dex `filtered` memo re-sorts ~1,380 Forms with `localeCompare` on every
  settled keystroke, although the sort key did not change.

After this plan a keystroke costs one filter pass over a pre-sorted array and
re-renders only rows whose data changed; a star toggle re-renders one row;
thumbs appear instantly when cached; tab switches no longer "fade in" the list.

## Current state

- `src/routes/dex.tsx` — Dex list (routes `/`). Rows at 497–543:

```497:531:src/routes/dex.tsx
          {virtualizer.getVirtualItems().map((row) => {
            const f = filtered[row.index]!
            const bst = calcBST(f.baseStats)
            const isSel = selected.has(f.id)
            return (
              <div
                key={f.id}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${row.start}px)` }}
                className={`grid grid-cols-[28px_36px_28px_1fr_140px_54px_54px_54px_54px_54px_54px_64px_84px] gap-2 px-4 py-1.5 items-center text-sm border-b border-[var(--ds-gray-200)] hover:bg-[var(--ds-gray-100)] ${isSel ? "bg-[var(--ds-gray-100)]" : ""}`}
              >
                <input type="checkbox" checked={isSel} onChange={() => toggleSelect(f.id)} className="rounded" />
                <span className="text-center tnum text-xs text-[var(--ds-gray-700)] tabular-nums">{row.index + 1}</span>
                <SpriteThumb form={f} />
                <span className="flex items-center gap-1 min-w-0">
                  <StarButton
                    className="h-6 w-6"
                    active={has({ kind: "form", formId: f.id })}
                    onToggle={() => toggle({ kind: "form", formId: f.id })}
                    label={has({ kind: "form", formId: f.id }) ? t("bookmarks.remove") : t("bookmarks.add")}
                  />
                  <Link
                    to="/form/$formId"
                    params={{ formId: f.id } as never}
                    className="text-left truncate hover:underline font-medium"
                    onClick={() => saveScroll()}
                    title={f.id}
                  >
                    {f.name}
                    {f.traits.length > 0 && <span className="ml-1 text-xs text-[var(--ds-gray-700)]">[{f.traits.join(",")}]</span>}
                  </Link>
                </span>
                <span className="flex gap-1">
                  {f.types.map((tt) => (
                    <LinkedTypeBadge key={tt} type={tt} />
                  ))}
```

  Filter/sort memo at 167–230 (filters `q`, traits, types; optional grouped
  collapse; then `[...out].sort(...)` with `localeCompare` for name/tier and
  numeric compares otherwise). `toggleSelect` at 266 is a `useCallback` with a
  functional `setSelected`. `saveScroll` at 261. Imports at 1–29 include
  `Link` from `@tanstack/react-router`, `LinkedTypeBadge`, `SpriteThumb`,
  `StarButton`, `useBookmarks`.

- `src/routes/moves.tsx` — Moves list. Rows at 366–403: `StarButton` +
  `<Link to="/moves/$moveId" className="contents text-left">` wrapping eight
  cells; computes `moveIdForName(m.name)` twice per row; `has({ kind: "move", moveId })`.
  Filter/sort memo at 206–236.

- `src/components/ui/sprite.tsx`:

```23:42:src/components/ui/sprite.tsx
// speciesId -> Base Form of that Species (dataset is immutable per app run)
let baseFormIndex: Map<number, Form> | null = null
function baseFormOf(forms: Form[], speciesId: number): SpriteBase | undefined {
  if (!baseFormIndex) {
    baseFormIndex = new Map()
    for (const f of forms) {
      if (f.isBaseForm && !baseFormIndex.has(f.speciesId)) baseFormIndex.set(f.speciesId, f)
    }
  }
  const b = baseFormIndex.get(speciesId)
  return b ? { id: b.id, name: b.name, speciesId: b.speciesId } : undefined
}

function useBaseFallback(form: FormLike): SpriteBase | undefined {
  const { data } = useDataset()
  return React.useMemo(() => {
    if (!data || form.isBaseForm) return undefined
    return baseFormOf(data.core.forms as Form[], form.speciesId)
  }, [data, form.speciesId, form.isBaseForm])
}
```

  `useSpriteManifest()` (44–57) is module-private. `SpriteLightbox` (69–216)
  is module-private, takes `{ form, src, open, onClose }`. `SpriteThumb`
  (286–329): `useI18n`, `useBaseFallback`, `useSpriteManifest`, four states,
  `<img loading="lazy" ... className="... opacity-0/opacity-100" style={{ transition: "opacity 180ms ease" }} onLoad={() => setThumbLoaded(true)}>`,
  wrapped in a `<button>` that opens the lightbox when `expandable`.

- `src/components/ui/badge.tsx` — `TypeBadge` (60–74, reads `useI18n().typeName`)
  and `LinkedTypeBadge` (81–93, a TanStack `<Link to="/types/$typeId">` around `TypeBadge`).

- `src/lib/bookmarks/store.ts`:

```85:88:src/lib/bookmarks/store.ts
export function hasBookmark(items: Bookmark[], ref: BookmarkRef): boolean {
  const k = bookmarkKey(ref)
  return items.some((b) => bookmarkKey(b) === k)
}
```

- `src/lib/bookmarks/BookmarksProvider.tsx:35-41` — `has` is
  `useCallback((ref) => hasBookmark(items, ref), [items])`; `toggle` is stable;
  `value = useMemo(() => ({ items, has, toggle }), [...])`.

- `src/lib/workspace/WorkspaceProvider.tsx` — document-level capture handlers
  (164–197): `internalAnchor(e.target)` finds the closest same-origin `<a href>`;
  Ctrl/meta/middle click opens the href in a new workspace tab; right-click
  opens the tab menu. `apply()` at 86–91 navigates with
  `router.history.replace(hrefOf(currentLocation(next)))`. `src/App.tsx:180`
  aliases `router.history.push` to `replace`, so replace is the app's only
  navigation primitive.

- `src/lib/domain/dexFilter.ts` (370 bytes) exports `formMatchesSelectedTypes`;
  `src/lib/domain/dexFilter.test.ts` tests it — use it as the test pattern.

- `src/lib/i18n.tsx:771-774` — `t` and `typeName` are `useCallback`s keyed on
  `lang`: stable identities between language switches.

Conventions: components are function components with `React.*` namespace
imports; Tailwind classes; `cn()` from `@/lib/utils`; tests are vitest in
`*.test.ts` next to the module, node environment (no DOM/RTL).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm exec tsc -b --pretty false` | exit 0 |
| Tests | `pnpm test` | all pass |
| Lint | `pnpm lint` | exit 0 |
| Dev server | `pnpm dev` | app at http://localhost:1420 (manual checks) |
| Ship gate | `powershell -ExecutionPolicy Bypass -File .\release.ps1` | exit 0 + artifact list |

## Scope

**In scope**:

- `src/routes/dex.tsx`, `src/routes/moves.tsx`
- `src/components/ui/sprite.tsx` (export helpers; add `ListSprite`)
- `src/components/ui/badge.tsx` (add `TypeBadgeAnchor`)
- `src/lib/bookmarks/store.ts`, `src/lib/bookmarks/BookmarksProvider.tsx`, `src/lib/bookmarks/store.test.ts`
- `src/lib/workspace/WorkspaceProvider.tsx` (one extra branch in the click handler)
- `src/lib/domain/dexFilter.ts`, `src/lib/domain/dexFilter.test.ts`
- `plans/README.md`

**Out of scope**:

- Other `LinkedTypeBadge` / `SpriteThumb` call sites (detail pages, Teams,
  TabBar, Favorites) — they render a handful of instances; leave them.
- `src/App.tsx` routes, `src/lib/workspace/state.ts`.
- Scroll restore / sessionStorage throttling / tab prewarm — Plan 007.
- Visual changes. Row markup, classes and column grid must stay identical.

## Git workflow

- Branch: `advisor/006-list-rows-render-cost`.
- Suggested commits (one per step): `perf(bookmarks): O(1) membership via key set`,
  `feat(workspace): data-nav plain anchors navigate in-app`,
  `perf(dex): memoized rows, ListSprite, anchors`, `perf(moves): memoized rows, anchors`,
  `perf(dex): sort once, filter per keystroke`.
- Do NOT push or open a PR unless the operator instructed it.

## Target design

```
DexPage
 ├ useSpriteManifest()            (one subscription for the page, not one per row)
 ├ sorted   = useMemo(sortForms(forms, sortBy, sortDir))          — changes only on sort
 ├ filtered = useMemo(filterForms(sorted, q, traits, types, grouped)) — per keystroke
 ├ starredKeys from useBookmarks() (Set)                          — O(1) per row
 ├ [lightbox, setLightbox]         (one SpriteLightbox for the page)
 └ rows: <DexRow key=id form index start selected starred manifest base
                 onToggleSelect onToggleStar onExpand typeName labels />   (React.memo)
       ├ <ListSprite form base manifest size=28 />   (no fade, no lazy, no context)
       ├ <a data-nav href="/form/<id>">              (no router hooks)
       └ <TypeBadgeAnchor type />  → <a data-nav href="/types/<Type>"><TypeBadge/></a>

WorkspaceProvider click capture: <a data-nav> + plain left click
   → preventDefault + router.history.replace(href)   (same primitive the tab bar uses)
```

## Steps

### Step 1: O(1) bookmark membership

`src/lib/bookmarks/store.ts` — add:

```ts
export function bookmarkKeySet(items: Bookmark[]): Set<string> {
  return new Set(items.map(bookmarkKey))
}
```

`src/lib/bookmarks/BookmarksProvider.tsx` — build the set once per `items`
and expose it:

```ts
const keys = React.useMemo(() => bookmarkKeySet(items), [items])
const has = React.useCallback((ref: BookmarkRef) => keys.has(bookmarkKey(ref)), [keys])
const value = React.useMemo(() => ({ items, keys, has, toggle }), [items, keys, has, toggle])
```

Add `keys: Set<string>` to the `Api` type. Keep `hasBookmark` in `store.ts`
(tests use it) but it is no longer called by the provider.

Test (`src/lib/bookmarks/store.test.ts`, follow the existing cases):
`bookmarkKeySet` returns a set whose size equals the number of distinct keys
and contains `bookmarkKey` of each item.

**Verify**: `pnpm test -- src/lib/bookmarks` → pass. `pnpm exec tsc -b --pretty false` → 0.

### Step 2: `data-nav` plain-anchor navigation

`src/lib/workspace/WorkspaceProvider.tsx`, inside the existing `onClick`
capture handler (after `if (!a) return`), add **before** the Ctrl/meta branch:

```ts
if (a.dataset.nav !== undefined && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
  e.preventDefault()
  e.stopPropagation()
  const href = a.getAttribute("href")
  if (href) router.history.replace(href)
  return
}
```

`router` is already in scope (`useRouter()` at line 74); add it to the effect's
dependency array. Ctrl/meta/middle/right-click behavior is untouched (those
branches run for any internal anchor, `data-nav` or not).

**Verify**: `pnpm exec tsc -b --pretty false` → 0. In `pnpm dev`, temporarily
add `<a data-nav href="/moves">x</a>` anywhere, click it → route changes
without a full reload and the tab bar updates; remove the temporary anchor.

### Step 3: Sprite helpers for list rows

`src/components/ui/sprite.tsx`:

1. Make `baseFormOf` return the indexed `Form` itself (stable identity — the
   memoized row depends on it) instead of a fresh object:
   `return baseFormIndex.get(speciesId)` (a `Form` satisfies `SpriteBase`).
2. `export` `useSpriteManifest`, `baseFormOf`, and `SpriteLightbox`.
3. Add:

```tsx
export function ListSprite({
  form,
  base,
  manifest,
  size = 28,
  className,
}: {
  form: FormLike
  base: SpriteBase | undefined
  manifest: SpriteManifest | null
  size?: number
  className?: string
}) {
  const src = manifest ? spriteUrls(form, "thumb", base, manifest).list[0] : undefined
  const [failed, setFailed] = React.useState<string | null>(null)
  if (!src || failed === src) {
    return <span className="w-7 h-7 rounded bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] inline-flex items-center justify-center text-[9px] text-[var(--ds-gray-700)] shrink-0">—</span>
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
      className={`object-contain shrink-0 ${className ?? ""}`}
      style={{ imageRendering: "auto" as never, width: size, height: size }}
      onError={() => setFailed(src)}
    />
  )
}
```

   No `loading="lazy"`, no opacity transition, no `onLoad` state, no
   `useI18n`/`useDataset`. (`spriteUrls` for `"thumb"` yields at most one URL —
   own still or base still — so the candidate cycling of `SpriteThumb` is
   unnecessary here.)

**Verify**: `pnpm exec tsc -b --pretty false` → 0; `pnpm test` → pass.

### Step 4: `TypeBadgeAnchor`

`src/components/ui/badge.tsx` — add next to `LinkedTypeBadge` (keep the old one):

```tsx
/** Hook-free variant of LinkedTypeBadge for virtualized rows: a plain anchor that WorkspaceProvider routes in-app via data-nav. */
export function TypeBadgeAnchor({ type, title, className }: { type: string; title?: string; className?: string }) {
  return (
    <a
      data-nav
      href={`/types/${encodeURIComponent(type)}`}
      title={title}
      className="shrink-0 rounded-md transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ds-blue-700)]"
    >
      <TypeBadge type={type} className={className} />
    </a>
  )
}
```

**Verify**: `pnpm exec tsc -b --pretty false` → 0.

### Step 5: Dex — extract and memoize `DexRow`

In `src/routes/dex.tsx`:

1. Hoist page-level values: `const manifest = useSpriteManifest()`;
   `const { keys: starredKeys, toggle } = useBookmarks()` (drop `has`);
   `const onToggleStar = React.useCallback((id: string) => toggle({ kind: "form", formId: id }), [toggle])`;
   `const [lightbox, setLightbox] = React.useState<Form | null>(null)`;
   `const onExpand = React.useCallback((f: Form) => setLightbox(f), [])`;
   `const starAdd = t("bookmarks.add")`, `const starRemove = t("bookmarks.remove")`.
2. Create a module-level memoized row **above** `DexPage`:

```tsx
type DexRowProps = {
  form: Form
  index: number
  start: number
  selected: boolean
  starred: boolean
  manifest: SpriteManifest | null
  base: SpriteBase | undefined
  starAdd: string
  starRemove: string
  typeName: (type: string) => string
  onToggleSelect: (id: string) => void
  onToggleStar: (id: string) => void
  onExpand: (form: Form) => void
}

const DexRow = React.memo(function DexRow(p: DexRowProps) {
  const f = p.form
  const bst = calcBST(f.baseStats)
  return (
    <div
      style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${p.start}px)` }}
      className={`grid grid-cols-[28px_36px_28px_1fr_140px_54px_54px_54px_54px_54px_54px_64px_84px] gap-2 px-4 py-1.5 items-center text-sm border-b border-[var(--ds-gray-200)] hover:bg-[var(--ds-gray-100)] ${p.selected ? "bg-[var(--ds-gray-100)]" : ""}`}
    >
      <input type="checkbox" checked={p.selected} onChange={() => p.onToggleSelect(f.id)} className="rounded" />
      <span className="text-center tnum text-xs text-[var(--ds-gray-700)] tabular-nums">{p.index + 1}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); p.onExpand(f) }}
        className="w-7 h-7 shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-blue-700)] inline-flex items-center justify-center cursor-zoom-in"
        aria-label={`Expandir ${f.name}`}
      >
        <ListSprite form={f} base={p.base} manifest={p.manifest} />
      </button>
      <span className="flex items-center gap-1 min-w-0">
        <StarButton className="h-6 w-6" active={p.starred} onToggle={() => p.onToggleStar(f.id)} label={p.starred ? p.starRemove : p.starAdd} />
        <a data-nav href={`/form/${encodeURIComponent(f.id)}`} className="text-left truncate hover:underline font-medium" title={f.id}>
          {f.name}
          {f.traits.length > 0 && <span className="ml-1 text-xs text-[var(--ds-gray-700)]">[{f.traits.join(",")}]</span>}
        </a>
      </span>
      <span className="flex gap-1">
        {f.types.map((tt) => <TypeBadgeAnchor key={tt} type={tt} title={p.typeName(tt)} />)}
        {f.types.length === 1 && <span className="w-[62px] shrink-0" />}
      </span>
      {/* the six stat cells, BST and tier cells: copy verbatim from the current row */}
    </div>
  )
})
```

3. Replace the inline row in the `map` with:

```tsx
<DexRow
  key={f.id}
  form={f}
  index={row.index}
  start={row.start}
  selected={selected.has(f.id)}
  starred={starredKeys.has(`form:${f.id}`)}
  manifest={manifest}
  base={f.isBaseForm ? undefined : baseFormOf(forms, f.speciesId)}
  starAdd={starAdd}
  starRemove={starRemove}
  typeName={typeName}
  onToggleSelect={toggleSelect}
  onToggleStar={onToggleStar}
  onExpand={onExpand}
/>
```

   **Check the key format**: open `src/lib/bookmarks/store.ts` `bookmarkKey`
   and use exactly the string it produces for `{ kind: "form", formId }`
   (if it is not `form:<id>`, import `bookmarkKey` and call
   `bookmarkKey({ kind: "form", formId: f.id })` instead of a template string).

4. Render the single lightbox after the list container:

```tsx
{lightbox && manifest && (
  <SpriteLightbox
    form={lightbox}
    src={spriteUrls(lightbox, "thumb", lightbox.isBaseForm ? undefined : baseFormOf(forms, lightbox.speciesId), manifest).list[0] ?? ""}
    open
    onClose={() => setLightbox(null)}
  />
)}
```

5. Remove the now-unused imports (`Link`, `LinkedTypeBadge`, `SpriteThumb`)
   and the `saveScroll` call site in the row (the scroll listener at line 257
   already persists position on every scroll; keep `saveScroll` only if
   something else uses it — otherwise delete it).

**Verify**: `pnpm exec tsc -b --pretty false` → 0; `pnpm lint` → 0. Manual in
`pnpm dev`: (a) type in the Dex search — list filters; (b) click a row name →
Form detail opens, Back returns; (c) Ctrl+click a row name → new workspace
tab; (d) click a type chip → Type hub; (e) star a row — only that row's star
changes, list does not flash; (f) click a sprite → lightbox opens with the
animated sprite; Esc closes; (g) select checkboxes → compare bar appears.

### Step 6: Moves — same treatment

In `src/routes/moves.tsx`, extract `MoveRow` (`React.memo`) with props
`{ move, start, learners: number | null, starred, starAdd, starRemove, onToggleStar }`
where `learners` is `null` until `extrasReady`. Compute `moveId` **once** in
the parent per row (`moveIdForName(m.name)`) and pass it as a prop; the row
renders `<a data-nav href={`/moves/${encodeURIComponent(moveId)}`} className="contents text-left">`
with the eight cells copied verbatim. `TypeBadge` stays (it is not a link
here). Use `starredKeys.has(bookmarkKey({ kind: "move", moveId }))`.

Remove the `Link` import and the row's `saveScroll` call as in Step 5.

**Verify**: `pnpm exec tsc -b --pretty false` → 0. Manual: Moves list
filters, row click opens Move detail, star toggles one row, learner counts
appear after extras load.

### Step 7: Dex — sort once, filter per keystroke

Move the pure logic into `src/lib/domain/dexFilter.ts`:

```ts
export type DexSortKey = "name" | "bst" | "hp" | "atk" | "def" | "spa" | "spd" | "spe" | "tier"

const collator = new Intl.Collator(undefined)

export function sortForms(forms: Form[], sortBy: DexSortKey, dir: "asc" | "desc"): Form[] {
  const sign = dir === "asc" ? 1 : -1
  return [...forms].sort((a, b) => {
    if (sortBy === "name") return collator.compare(a.name, b.name) * sign
    if (sortBy === "tier") return collator.compare(a.tier ?? "", b.tier ?? "") * sign
    if (sortBy === "bst") return (calcBST(a.baseStats) - calcBST(b.baseStats)) * sign
    return (a.baseStats[sortBy] - b.baseStats[sortBy]) * sign
  })
}

/** Ranking collapse: one representative per Species when all its Forms share a BST; otherwise keep every Form. Preserves input order. */
export function collapseSpecies(list: Form[]): Form[] {
  const bySpecies = new Map<number, Form[]>()
  for (const f of list) {
    const arr = bySpecies.get(f.speciesId)
    if (arr) arr.push(f)
    else bySpecies.set(f.speciesId, [f])
  }
  const keep = new Set<string>()
  for (const group of bySpecies.values()) {
    if (group.length <= 1) { keep.add(group[0]!.id); continue }
    const bsts = new Set(group.map((g) => calcBST(g.baseStats)))
    if (bsts.size === 1) keep.add((group.find((g) => g.isBaseForm) ?? group[0]!).id)
    else for (const g of group) keep.add(g.id)
  }
  return list.filter((f) => keep.has(f.id))
}
```

(`calcBST` is in `@/lib/utils`; import it. `dexFilter.ts` must stay free of
React imports — it is tested in node.)

In `dex.tsx` replace the single `filtered` memo with two:

```ts
const sorted = React.useMemo(() => sortForms(forms, sortBy, sortDir), [forms, sortBy, sortDir])
const filtered = React.useMemo(() => {
  let out = sorted
  const q = (search.q ?? deferredQuery).trim().toLowerCase()
  if (q) out = out.filter((f) => f.name.toLowerCase().includes(q) || f.id.includes(q))
  // traits and types filters: copy the two existing blocks verbatim
  if (grouped && sortBy !== "name") out = collapseSpecies(out)
  return out
}, [sorted, search.q, deferredQuery, selectedTraits, selectedTypes, grouped, sortBy])
```

Semantics preserved: the same rows are kept; order is the sort order.
Acceptable difference: among rows with **equal** sort keys, the new order is
dataset order rather than group-insertion order (both deterministic).

Tests in `src/lib/domain/dexFilter.test.ts` (inline `Form` fixtures like the
existing test):

1. `sortForms` by `name` asc/desc; by `spe` desc puts the fastest first; by
   `bst` uses the six-stat sum.
2. `collapseSpecies`: two Forms of one Species with equal BST → one row, the
   base Form; with different BST → both rows; a single-Form Species → kept;
   output order equals input order.

**Verify**: `pnpm test -- src/lib/domain/dexFilter.test.ts` → pass (≥ 5 new
cases). `pnpm test` → all pass. `pnpm exec tsc -b --pretty false` → 0.

### Step 8: Ship gate

Run `release.ps1` → exit 0. Launch the exe and repeat the manual checks of
Steps 5–6 once on the release build.

## Test plan

- `src/lib/bookmarks/store.test.ts`: `bookmarkKeySet` (Step 1).
- `src/lib/domain/dexFilter.test.ts`: `sortForms` ×3, `collapseSpecies` ×3 (Step 7).
- No component tests (vitest runs in node without DOM) — the manual checklists
  in Steps 5–6 are the UI gate.
- Verification: `pnpm test` → all pass, at least 7 new cases.

## Done criteria

ALL must hold:

- [ ] `rg "from \"@tanstack/react-router\"" src/routes/dex.tsx src/routes/moves.tsx` → each file imports only `useNavigate`/`useSearch` (no `Link`)
- [ ] `rg "LinkedTypeBadge|SpriteThumb" src/routes/dex.tsx src/routes/moves.tsx` → no matches
- [ ] `rg "React.memo" src/routes/dex.tsx src/routes/moves.tsx` → one match each (`DexRow`, `MoveRow`)
- [ ] `rg "loading=\"lazy\"|transition: \"opacity" src/components/ui/sprite.tsx` → matches only inside `Sprite`, `SpriteThumb`, `SpriteLightbox` — none inside `ListSprite`
- [ ] `rg "data-nav" src/lib/workspace/WorkspaceProvider.tsx src/components/ui/badge.tsx src/routes/dex.tsx src/routes/moves.tsx` → ≥ 4 matches
- [ ] `rg "items.some" src/lib/bookmarks/BookmarksProvider.tsx` → no matches; `keys` exposed on the API
- [ ] `rg "export function sortForms|export function collapseSpecies" src/lib/domain/dexFilter.ts` → 2 matches
- [ ] `pnpm exec tsc -b --pretty false` 0; `pnpm test` 0 (≥ 113 tests); `pnpm lint` 0
- [ ] `release.ps1` exit 0 with artifact list
- [ ] `git status` shows only in-scope files
- [ ] `plans/README.md` status row for 006 updated

## STOP conditions

- Excerpts drifted.
- `bookmarkKey` for forms/moves is not a simple deterministic string (Step 5.3) —
  report instead of inventing a format.
- Ctrl+click / middle-click / right-click on a `data-nav` anchor stops opening
  a new workspace tab (the capture-handler order in Step 2 must keep those
  branches reachable) — fix once; if still broken, stop.
- The Ranking (grouped) view shows a different **set** of rows than before
  Step 7 for the same filters (order differences among equal keys are fine;
  a different set is a bug) — stop and report with the filter used.
- `pnpm lint` flags the `React.memo` component for `react/display-name` or
  similar and the named-function form in Step 5 does not satisfy it — stop.
- Verification fails twice for the same step.

## Maintenance notes

- New list rows anywhere in the app should follow `DexRow`: memoized, plain
  `data-nav` anchors, `ListSprite`, booleans computed by the parent.
- `data-nav` is now an app-level contract handled in `WorkspaceProvider`. If
  the router ever stops aliasing `push` to `replace` (`src/App.tsx:180`), revisit
  whether `router.history.replace` is still the right primitive there.
- Reviewers: diff the row JSX against the removed inline version — classes and
  column order must be byte-identical except for the `Link` → `a` swaps.
- Deferred to Plan 007: scroll restore without the double-rAF jump,
  sessionStorage write throttling, route chunk prewarm.
- Deferred (not planned): removing the fade from `SpriteThumb`/`Sprite` at the
  remaining call sites — cosmetic there.
