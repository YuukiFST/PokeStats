# Plan 003: Unblock the Dex after `core.json`; load sets and learnsets in the background

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat HEAD -- src/lib/dataset/load.ts src/hooks/useDataset.ts src/routes/dex.tsx src/routes/formDetail.tsx src/routes/moves.tsx src/routes/moveDetail.tsx src/routes/teams.tsx src/components/teams/TeamAnalysis.tsx src/components/teams/ThreatMatchup.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (independent of 001/002; can run in parallel with them)
- **Category**: perf
- **Planned at**: working tree 2026-08-30 (no short SHA recorded; treat excerpt mismatch as drift)

## Why this matters

Cold start waits on three sequential `fetch`+`json()` calls (`core.json`, then `sets.json`, then `learnsets.json`) plus indexing, then the Dex skeleton unmounts (`useDataset().loading`). The Dex table only needs `core.forms`. Sets and learnsets matter on Form detail, Moves learner counts, move hub, and Teams / Smart Counters. Parsing the extras before first paint is the main **data** cost of "slow when I open the exe".

The intelligent approach is **one `LoadedDataset` type** (no dual hooks, no optional `sets` that every caller must null-check) with an `extrasReady: boolean` flag: show Dex when core indexes exist; keep `sets.sets` as `[]` and `learnsets` as `{}` until the second stage finishes; then replace them and notify subscribers. Surfaces that would lie ("No Sets") while extras are in flight must wait or show `detail.loading`.

## Current state

- `src/lib/dataset/load.ts` — `loadDataset()` sequential fetches; caches a full `LoadedDataset`; module-init preload.
- `src/hooks/useDataset.ts` — `loading` until `loadDataset()` resolves; no second-stage signal.
- Dex: `src/routes/dex.tsx:24` `const { data, loading, error } = useDataset()`; skeleton while `loading` (`:264-271`). Uses `data.core.forms` only.
- Form sets tab: `src/routes/formDetail.tsx:73` filters `data.sets.sets`; empty → `t("detail.noSets")` (`:212-213`).
- Moves list: `src/routes/moves.tsx:182-209` sorts by learner count from `data.learnsets`.
- Move hub: `src/routes/moveDetail.tsx:30-40` scans `data.sets.sets` to resolve some move names; `:90-91` uses `data.learnsets`.
- Teams: `TeamAnalysis.tsx:143` `data.sets.sets`; `ThreatMatchup.tsx:139-141` `buildSmartCounterIndex(..., data.sets.sets, ...)`.
- `usePalette.tsx` uses `data` for Form/move names from core — OK on core-only.
- `TabBar.tsx` `formsById` from core — OK.
- `LoadedDataset` in `load.ts:5-20` always includes `sets` and `learnsets`.
- `DatasetSets` is `{ sets: Set[] }` (`src/lib/domain/types.ts:216-218`). Learnsets missing file already degrades to `{}` (`load.ts:39-46`).

Excerpt to replace (sequential + single cache):

```25:47:src/lib/dataset/load.ts
export async function loadDataset(): Promise<LoadedDataset> {
  if (cache) return cache
  if (inflight) return inflight

  inflight = (async () => {
    const started = performance.now()
    const coreRes = await fetch("/dataset/core.json")
    if (!coreRes.ok) throw new Error(`core.json fetch failed: ${coreRes.status}`)
    const core: DatasetCore = await coreRes.json()

    const setsRes = await fetch("/dataset/sets.json")
    if (!setsRes.ok) throw new Error(`sets.json fetch failed: ${setsRes.status}`)
    const sets: DatasetSets = await setsRes.json()

    // learnsets.json is optional ...
```

Excerpt — hook has no extras flag:

```4:36:src/hooks/useDataset.ts
export function useDataset() {
  const sync = getDatasetSync()
  const [data, setData] = React.useState<LoadedDataset | null>(sync)
  const [loading, setLoading] = React.useState(!sync)
  // ...
  return { data, loading, error }
}
```

Conventions:

- Extract **pure** indexing into a function tests can call without `fetch` (same idea as `src/lib/domain/moveset.test.ts`).
- Keep `resolveMoveInfo` / `moveIdForName` / `learnersForMove` signatures unless a test requires a tweak.
- i18n: add keys next to existing `detail.loading` / `detail.noSets` in both `en` and `pt-BR` objects in `src/lib/i18n.tsx`.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Tests     | `pnpm test -- src/lib/dataset/load.test.ts` | all pass |
| Full tests | `pnpm test` | all pass |
| Lint      | `pnpm lint` | exit 0 |
| Typecheck | `pnpm exec tsc -b --pretty false` | exit 0 |

## Suggested executor toolkit

- None.

## Scope

**In scope**:

- `src/lib/dataset/load.ts`
- `src/lib/dataset/load.test.ts` (create)
- `src/hooks/useDataset.ts`
- `src/routes/formDetail.tsx` — Sets tab empty/loading only
- `src/routes/moves.tsx` — learner sort / displayed count when `!extrasReady`
- `src/routes/moveDetail.tsx` — learners list + `resolveMove` when `!extrasReady`
- `src/components/teams/TeamAnalysis.tsx` — skip set-aware suggestions until extras ready (or treat as loading)
- `src/components/teams/ThreatMatchup.tsx` — do not `buildSmartCounterIndex` on empty sets as if complete; wait for `extrasReady`
- `src/lib/i18n.tsx` — new string(s) for extras still loading
- `plans/README.md` (status)

**Out of scope**:

- Sprite plans 001/002
- Splitting `core.json` itself or changing dataset build (`tools/dataset/**`)
- `React.lazy` / `src/App.tsx` (explicitly not selected)
- Changing Dex filters/sort algorithms
- Making `sets.json` fetch failure silent — **core failure still throws**; extras: if `sets.json` fails, STOP is not required if you set `extrasReady: true` with empty sets and `console.warn` once (same honesty as optional learnsets). Prefer: `sets.json` failure logs and leaves `extrasReady: true` with `{ sets: [] }` so the UI is not stuck in loading forever. `core.json` failure still sets `error` on the hook.

## Git workflow

- Branch: `advisor/003-staged-dataset-load` (or current operator branch).
- Commit message: `Show the Dex after core.json; load Sets and learnsets in the background.`
- Do NOT push or open a PR unless the operator instructed it.

## Target design

### Pure indexer (testable)

In `load.ts`:

```ts
export function indexCore(core: DatasetCore): Omit<LoadedDataset, "sets" | "learnsets" | "extrasReady">
```

This contains today's Map builds, `enrichment`, `nameIndex` sort, `defensiveProfile` loop. Then:

```ts
export function withExtras(
  indexed: ReturnType<typeof indexCore> & { core: DatasetCore },
  sets: DatasetSets,
  learnsets: LearnsetsArtifact,
  extrasReady: boolean,
): LoadedDataset
```

`LoadedDataset` gains `extrasReady: boolean`. Always include `core` on the object (indexed already has it if you put `core` on the return of `indexCore` — simplest: `indexCore` returns everything except sets/learnsets/extrasReady, and you spread `{ ...indexCore(core), core, sets, learnsets, extrasReady }`).

Look at the current cache assignment (`load.ts:72`) and keep every field.

### Loader state machine

Module-level:

- `cache: LoadedDataset | null`
- `coreInflight` / `extrasInflight` as needed so concurrent `loadDataset()` / `ensureExtras()` share work
- `listeners: Set<() => void>` — `subscribeDataset(fn): () => void`

Sequence:

1. `fetch("/dataset/core.json")` — on !ok, throw (Dex error UI).
2. `indexCore`, `cache = { ...indexed, sets: { sets: [] }, learnsets: {}, extrasReady: false }`, notify listeners, **return this object from the first `loadDataset()` waiters** so the Dex can render.
3. Start extras without awaiting in the Dex path: `Promise.all` of `sets.json` (required: if !ok, warn and use `{ sets: [] }`) and `learnsets.json` (optional `{}` as today).
4. `cache = { ...previous indexed fields, sets, learnsets, extrasReady: true }` — **reuse the same `formsById` etc. from step 2**; do not re-run `defensiveProfile`. Notify listeners.

Keep `getDatasetSync()` returning `cache` (core-ready or full).

Keep module-init `void loadDataset().catch(() => {})`.

`loadDataset()` should resolve at **core-ready** (not wait for extras). Export `ensureExtras(): Promise<void>` that awaits extras inflight (for tests or future callers). `useDataset` will subscribe so React sees extras.

Logs: `[dataset] core ...ms` after step 2; `[dataset] extras ...ms` after step 4. Keep the >500ms warn on each stage separately.

### `useDataset`

```ts
return { data, loading, error, extrasReady: data?.extrasReady ?? false }
```

- `loading` is true only while `data` is null (core not ready) or core fetch failed (`error`).
- Subscribe in `useEffect` to `subscribeDataset` so extras flip re-renders even if `getDatasetSync()` identity changes.

Implementation sketch: store `version` incremented on each notify; `setData(getDatasetSync())`.

Do not keep a stale `data` object with `extrasReady: false` after cache already has extras — always read from `getDatasetSync()` on notify.

### UI gates (required so empty extras are not a lie)

| Surface | When `data && !data.extrasReady` |
|---------|----------------------------------|
| Dex | render list as today (core only) |
| Form detail stats tab | OK |
| Form detail sets tab | show `t("detail.loading")` (or a new `detail.setsLoading`) instead of `detail.noSets` |
| Moves table learner column / sort by learners | treat counts as 0 for sort **or** disable learner sort until ready; displayed cell: `—` until ready (do not flash 0 then 400). Prefer `—` in the cell; if `sortBy === "learners"`, keep current order (stable name) until ready then re-sort. |
| Move detail learners | show `t("detail.loading")` for the learners block until extrasReady |
| `resolveMove` set-scan | if extras not ready and movesById miss, still return desluge; after extras, re-resolve via hook rerender |
| TeamAnalysis suggestions | if `!data.extrasReady`, `formsWithSets` = empty set but also skip calling `suggestTeamAdditions`? Empty set would rank as if nobody has Sets. **Must wait**: if `!extrasReady`, return `{ items: [], rankedPoolSize: 0, rankedPool: [] }` **and** show a one-line `t("detail.loading")` in that panel (find the suggestions header in `TeamAnalysis.tsx` and add the line). |
| ThreatMatchup `smartIndex` | `useMemo` returns empty index (`profiles/battle/setCount` empty Maps) until `extrasReady`; when Smart mode is on, show loading text instead of a bogus ranking |

Do not change `teams.tsx` beyond what those children need if the parent only passes `data`.

## Steps

### Step 1: Pure `indexCore` / `withExtras` + tests

Create `src/lib/dataset/load.test.ts`. Use a **tiny** `DatasetCore` fixture inline (one Species, two Forms, one move/item/ability/nature). Do not import `public/dataset/core.json`.

Cases:

1. `indexCore` builds `formsById` and `enrichment` BST = sum of six stats.
2. `withExtras(..., extrasReady: false)` has empty sets and `extrasReady === false`.
3. `withExtras(..., extrasReady: true)` preserves the same `formsById` reference if you pass the same indexed object (document in test: `expect(full.formsById).toBe(indexedMaps)` if you keep the reference — if not, at least same keys).

**Verify**: `pnpm test -- src/lib/dataset/load.test.ts` → pass. This step may leave `loadDataset` still sequential; wire in Step 2.

### Step 2: Staged fetch + subscribe

Implement the state machine. `Promise.all` for the two extra files. Notify after core and after extras.

Add a test for subscribe if you can do it without mocking `fetch`: e.g. export `__resetDatasetCacheForTests()` that nulls cache/listeners — **only if** oxlint allows. Prefer not to mock fetch; Step 1 coverage is enough for indexing. If you add reset + fake fetch, keep it in `load.test.ts` with `globalThis.fetch = ...` restored in `afterEach`. Optional; do not spend more than one attempt. If fetch-mock is messy, skip and rely on UI using `extrasReady`.

**Verify**: `pnpm exec tsc -b --pretty false` → 0.

### Step 3: Hook + UI gates + i18n

Update `useDataset` and the surfaces in the table. Add `detail.setsLoading` in en and pt-BR (English: `Loading Sets…`; pt-BR: `Carregando Sets…`) if you do not reuse `detail.loading`.

**Verify**: `pnpm lint` → 0. `pnpm test` → all pass.

## Test plan

- New `src/lib/dataset/load.test.ts` as Step 1 (required).
- Optional fetch/subscribe test.
- No Dex RTL tests (vitest is node).
- Pattern: `src/lib/domain/moveset.test.ts`.

Verification: `pnpm test` → all pass.

## Done criteria

- [ ] `pnpm exec tsc -b --pretty false` exits 0
- [ ] `pnpm test` exits 0; `src/lib/dataset/load.test.ts` exists
- [ ] `pnpm lint` exits 0
- [ ] `LoadedDataset` has `extrasReady`
- [ ] `load.ts` fetches `sets.json` and `learnsets.json` via `Promise.all` (not await-sets-then-learnsets)
- [ ] `formDetail.tsx` does not show `detail.noSets` while `!extrasReady`
- [ ] `rg "await fetch\(\"/dataset/sets" src/lib/dataset/load.ts` — after the change, sets and learnsets are not strictly sequential awaits of each other (both started together)
- [ ] No files outside the in-scope list (`git status`)
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

- Excerpts drifted (especially `LoadedDataset` shape).
- You feel you must make `sets` optional on the type — that is the dual-hook design this plan rejected; stop and report.
- Form detail or Teams would show "no Sets" / Smart Counters ranking on an empty array while extras are still in flight and you cannot find a loading UI slot — stop rather than shipping the lie.
- Verification fails twice.
- `core.json` path would become optional — it must stay required.

## Maintenance notes

- Reviewers: confirm Dex `loading` is false after core only (log `[dataset] core` vs extras). Existing `[perf] first paint` in `App.tsx` is JS, not JSON; extras should not block it.
- If a later feature needs Sets on the Dex row, it must wait on `extrasReady` or it will be wrong.
- Deferred: code-splitting `src/App.tsx` (not selected). Do not sneak it in.
