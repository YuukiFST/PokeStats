# Plan 008: Stop Threat Matchup from re-scoring 1,380 Forms on every keystroke — cache the Smart index, split score from window, memoize per opponent

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0b6331f..HEAD -- src/components/teams/ThreatMatchup.tsx src/lib/domain/smartCounters.ts src/lib/domain/recommend.ts src/lib/domain/smartCounters.test.ts src/lib/domain/recommend.test.ts`
> If the output is not empty, compare every "Current state" excerpt below with
> the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (pure refactor of when things compute, not what they compute;
  golden tests pin the results)
- **Depends on**: none (independent of Plans 004–007)
- **Category**: perf
- **Planned at**: commit `0b6331f`, 2026-09-01

## Why this matters

The Teams → Matchup tab is the heaviest screen in the app, and it does its
heavy work in the wrong place:

1. `buildSmartCounterIndex` — a full pass over all 1,380 Forms and ~4,000 Sets
   (moveset profiles + battle-state estimates) — runs in a `useMemo` keyed on
   `[data]`. It re-runs on **every mount** of the component (every visit to the
   Matchup tab, every Back from a counter's detail page) and whenever the
   staged dataset object changes identity. It also runs in *Dataset* mode,
   where its output is never read.
2. Per opponent, `suggestCounters` / `suggestSmartCounters` (score all 1,380
   Forms, sort, window) are called **in the render body** — not memoized. Every
   render of `ThreatMatchup` recomputes them for every opponent. Every
   keystroke in the "add opponent" search box is a render (`query` is local
   state), so with three opponents typing "gar" runs nine full scans.
   Pinning or rotating counters does the same, though only the *window* step
   (cheap) actually depends on pins/offset.

On the release build this is the difference between the Matchup tab appearing
in one frame and appearing after a visible pause, and between the opponent
search feeling like a text field and feeling like a form submit. The fix is
mechanical: cache the index per dataset load, memoize the scoring per
opponent, and let pins/rotation re-window a cached score list.

## Current state

- `src/components/teams/ThreatMatchup.tsx`:

```139:145:src/components/teams/ThreatMatchup.tsx
  const smartIndex = React.useMemo(
    () =>
      data.extrasReady
        ? buildSmartCounterIndex(data.core.forms as Form[], data.sets.sets, data.movesByName, data.naturesByName)
        : { profiles: new Map(), battle: new Map(), setCount: new Map() },
    [data],
  )
```

```256:270:src/components/teams/ThreatMatchup.tsx
      {opponents.map((opp) => {
        const { recommended, avoid } = recommendAttackTypes(opp.types as unknown as TypeName[])
        const matchups = members.map((m) => memberMatchup(m.types as unknown as TypeName[], opp.types as unknown as TypeName[], m.id))
        const edgeCount = matchups.filter((mm) => mm.bestStabMult >= 2).length
        const excludeIds = new Set([...members.map((m) => m.id), ...opponents.map((o) => o.id)])
        const pins = pinnedCounters.get(opp.id)
        const windowOpts = { offset: counterOffset.get(opp.id) ?? 0, pinnedIds: pins }
        const datasetCounters =
          counterMode === "dataset"
            ? suggestCounters(opp.types as unknown as TypeName[], data.core.forms as Form[], excludeIds, windowOpts)
            : null
        const smartCounters =
          counterMode === "smart" && data.extrasReady
            ? suggestSmartCounters(opp, smartIndex, data.core.forms as Form[], excludeIds, windowOpts)
            : null
```

  The rest of that `.map` callback (lines 271–414) is the opponent card JSX:
  header with `Sprite`, recommended/avoid chips, per-member matchup rows, and
  the counters grid using `CounterCard`. Local state: `query`, `extraTypes`,
  `pinnedCounters: Map<oppId, Set<formId>>`, `counterOffset: Map<oppId, number>`.
  Handlers `togglePin(oppId, formId)`, `rotateCounters(oppId)`,
  `removeOpponent(id)` are plain (non-`useCallback`) closures.

- `src/lib/domain/smartCounters.ts` — `buildSmartCounterIndex(forms, sets, movesByName, naturesByName)` (34–58);
  `suggestSmartCounters(opp, index, allForms, excludeIds, opts)` (160–234) builds
  `scored` then `return windowByBst(scored, opts)` (233).
- `src/lib/domain/recommend.ts` — `windowByBst(scored, opts)` (396–417, exported);
  `suggestCounters(oppTypes, allForms, excludeIds, opts)` (420–430) is
  `scored = allForms.filter(...).map(form => ({ form, ...typeMathCounterScore(form, oppTypes) }))` then `windowByBst`.
- `src/routes/teams.tsx:278-288` renders `<ThreatMatchup team members data ptBR onChange counterMode onCounterModeChange />`
  only when `tab === "matchup"`. `onChange` is an inline arrow (new identity per
  `TeamsPage` render) — `TeamsPage` does not re-render on Matchup-local state.
- `src/lib/i18n.tsx:774` — the `useI18n()` value is memoized; `t` and
  `typeName` are stable per language.
- `src/components/teams/TeamAnalysis.tsx` already memoizes its computations
  (`useMemo` at 134–186) — use it as the in-repo exemplar.
- Tests: `src/lib/domain/smartCounters.test.ts` (golden scores with fixtures
  from `./testFixtures`), `src/lib/domain/recommend.test.ts`.

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

- `src/lib/domain/smartCounters.ts` — `scoreSmartCounters` split + index cache helper
- `src/lib/domain/recommend.ts` — `scoreCounters` split
- `src/lib/domain/smartCounters.test.ts`, `src/lib/domain/recommend.test.ts` — equivalence tests
- `src/components/teams/ThreatMatchup.tsx` — `OpponentCard` extraction, memoization
- `plans/README.md`

**Out of scope**:

- Scoring formulas, weights, window size, BST ordering — **no behaviour change**.
- `TeamAnalysis.tsx`, `TeamSlots.tsx`, `teams.tsx`.
- Link/`SpriteThumb` costs inside cards (Plan 006 territory).

## Git workflow

- Branch: `advisor/008-threat-matchup-compute`.
- Suggested commits: `refactor(domain): split counter scoring from windowing`,
  `perf(teams): cache smart index per dataset; memoize per-opponent counters`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Split scoring from windowing (pure refactor)

`src/lib/domain/recommend.ts` — extract the scoring half of `suggestCounters`:

```ts
/** Score every candidate vs one opponent (no window). Pure; cache by (oppTypes, allForms, excludeIds). */
export function scoreCounters(oppTypes: TypeName[], allForms: Form[], excludeIds: ReadonlySet<string>): FormSuggestion[] {
  return allForms
    .filter((f) => !excludeIds.has(f.id))
    .map((form) => ({ form, ...typeMathCounterScore(form, oppTypes) }))
}

export function suggestCounters(oppTypes: TypeName[], allForms: Form[], excludeIds: Set<string>, opts: CounterWindowOptions = {}): FormSuggestion[] {
  return windowByBst(scoreCounters(oppTypes, allForms, excludeIds), opts)
}
```

`src/lib/domain/smartCounters.ts` — same for `suggestSmartCounters`: move
everything from `const oppProfile = …` through the end of the `.map(...)` into
`export function scoreSmartCounters(opp, index, allForms, excludeIds): SmartFormSuggestion[]`
and make `suggestSmartCounters` = `windowByBst(scoreSmartCounters(opp, index, allForms, excludeIds), opts)`.

Add an index cache in `smartCounters.ts`:

```ts
const indexCache = new WeakMap<Set[], SmartCounterIndex>()

/** One SmartCounterIndex per Sets array identity — the dataset loads Sets once, so this is once per app run. */
export function getSmartCounterIndex(
  forms: Form[],
  sets: Set[],
  movesByName: Map<string, MoveInfo>,
  naturesByName: Map<string, NatureInfo>,
): SmartCounterIndex {
  const hit = indexCache.get(sets)
  if (hit) return hit
  const built = buildSmartCounterIndex(forms, sets, movesByName, naturesByName)
  indexCache.set(sets, built)
  return built
}
```

Tests:
- `recommend.test.ts`: `windowByBst(scoreCounters(...), opts)` deep-equals
  `suggestCounters(..., opts)` for one fixture opponent (reuse an existing
  fixture in that file).
- `smartCounters.test.ts`: same equivalence for `scoreSmartCounters`; plus
  `getSmartCounterIndex(forms, sets, …)` called twice with the same `sets`
  array returns the **same reference**, and a copied array returns a new one.

**Verify**: `pnpm test -- src/lib/domain` → all pass, including the existing
golden score assertions unchanged.

### Step 2: Extract a memoized `OpponentCard`

In `ThreatMatchup.tsx`, move the body of the `opponents.map((opp) => …)`
callback (lines 257–414) into a new component in the same file:

```ts
interface OpponentCardProps {
  opp: Form
  members: Form[]
  excludeIds: ReadonlySet<string>      // members + all opponents; built once in the parent
  forms: Form[]                        // data.core.forms
  counterMode: CounterMode
  extrasReady: boolean
  smartIndex: SmartCounterIndex | null // null until extras are ready or in dataset mode
  pins: ReadonlySet<string> | undefined
  offset: number
  extraTypes: ReadonlySet<TypeName>
  ptBR: boolean
  onRemove: (oppId: string) => void
  onPin: (oppId: string, formId: string) => void
  onRotate: (oppId: string) => void
}

const OpponentCard = React.memo(function OpponentCard(p: OpponentCardProps) {
  const { t, typeName } = useI18n()
  const oppTypes = p.opp.types as unknown as TypeName[]
  const { recommended, avoid } = React.useMemo(() => recommendAttackTypes(oppTypes), [p.opp])
  const matchups = React.useMemo(
    () => p.members.map((m) => memberMatchup(m.types as unknown as TypeName[], oppTypes, m.id)),
    [p.members, p.opp],
  )
  const edgeCount = matchups.filter((mm) => mm.bestStabMult >= 2).length

  const datasetScored = React.useMemo(
    () => (p.counterMode === "dataset" ? scoreCounters(oppTypes, p.forms, p.excludeIds) : null),
    [p.counterMode, p.opp, p.forms, p.excludeIds],
  )
  const smartScored = React.useMemo(
    () => (p.counterMode === "smart" && p.smartIndex ? scoreSmartCounters(p.opp, p.smartIndex, p.forms, p.excludeIds) : null),
    [p.counterMode, p.opp, p.smartIndex, p.forms, p.excludeIds],
  )
  const windowOpts = React.useMemo(() => ({ offset: p.offset, pinnedIds: p.pins as Set<string> | undefined }), [p.offset, p.pins])
  const datasetCounters = React.useMemo(() => (datasetScored ? windowByBst(datasetScored, windowOpts) : null), [datasetScored, windowOpts])
  const smartCounters = React.useMemo(() => (smartScored ? windowByBst(smartScored, windowOpts) : null), [smartScored, windowOpts])

  // …existing JSX from lines 272–413, with:
  //   removeOpponent(opp.id)      → p.onRemove(p.opp.id)
  //   togglePin(opp.id, formId)   → p.onPin(p.opp.id, formId)
  //   rotateCounters(opp.id)      → p.onRotate(p.opp.id)
  //   data.extrasReady            → p.extrasReady
  //   extraTypes / ptBR           → p.extraTypes / p.ptBR
})
```

`windowByBst` typing: `CounterWindowOptions.pinnedIds` is `Set<string> | undefined` —
keep the cast shown above or widen the option type to `ReadonlySet<string>`
in `recommend.ts` (preferred; it is read-only there).

In the parent:

- `smartIndex`: replace the `useMemo` with
  `const smartIndex = React.useMemo(() => (counterMode === "smart" && data.extrasReady ? getSmartCounterIndex(data.core.forms as Form[], data.sets.sets, data.movesByName, data.naturesByName) : null), [counterMode, data])`.
  (The cache makes the `[data]` dependency harmless: a new staged `data`
  object with the same `sets.sets` array is a cache hit.)
- `excludeIds`: `React.useMemo(() => new Set([...members.map((m) => m.id), ...opponents.map((o) => o.id)]), [members, opponents])`.
- Wrap `togglePin`, `rotateCounters`, `removeOpponent` in `React.useCallback`
  (`removeOpponent` depends on `onChange` and `team.opponents`; the two state
  setters have no deps).
- Render `<OpponentCard key={opp.id} opp={opp} members={members} excludeIds={excludeIds} forms={data.core.forms as Form[]} counterMode={counterMode} extrasReady={data.extrasReady} smartIndex={smartIndex} pins={pinnedCounters.get(opp.id)} offset={counterOffset.get(opp.id) ?? 0} extraTypes={extraTypes} ptBR={ptBR} onRemove={removeOpponent} onPin={togglePin} onRotate={rotateCounters} />`.

Result: typing in the search box changes only `query`; every `OpponentCard`
prop is referentially stable, so `React.memo` skips them. Pinning changes
`pins` for one opponent → only that card re-renders, and only its cheap
`windowByBst` memo recomputes. The `data.core.forms` array identity is
stable across staged loads (confirm with `rg "forms:" src/lib/dataset/load.ts`
→ no re-mapping of `forms`).

**Verify**: `pnpm exec tsc -b --pretty false` → 0; `pnpm lint` → 0.
Manual in `pnpm dev` with React DevTools "Highlight updates" on: Teams →
Matchup with 2–3 opponents; type in the opponent search — opponent cards do
**not** highlight; pin a counter — only that card highlights; toggle
Dataset/Smart — all cards highlight once. Console: no warnings about missing
`key`s or hook order.

### Step 3: Instrument once, then remove

Temporarily wrap `scoreSmartCounters` in `console.time`/`console.timeEnd`
in the card memo and confirm in the console that typing in the search box
produces **zero** timing lines and that switching to Smart the second time
(after a tab away and back) does not log a `buildSmartCounterIndex` rebuild
(add a `console.log("[perf] smart index built")` inside `buildSmartCounterIndex`
for the check). Remove both logs before committing.

**Verify**: `rg "console\.(time|log)" src/lib/domain/smartCounters.ts src/components/teams/ThreatMatchup.tsx` → no matches.

### Step 4: Ship gate

`release.ps1` → exit 0. In the release exe: Teams → Matchup with three
opponents in Smart mode; typing in the search box must be as responsive as
the Dex search; Back from a counter's detail page must show the tab without
a pause.

## Test plan

- `recommend.test.ts`: 1 equivalence test (`scoreCounters` + `windowByBst` ≡ `suggestCounters`).
- `smartCounters.test.ts`: 1 equivalence test; 1 cache identity test (2 assertions).
- Existing golden tests must pass unchanged — they are the behavioural guard.
- Verification: `pnpm test` → all pass.

## Done criteria

ALL must hold:

- [ ] `rg "export function (scoreCounters|scoreSmartCounters|getSmartCounterIndex)" src/lib/domain` → 3 matches
- [ ] `rg "React.memo\(function OpponentCard" src/components/teams/ThreatMatchup.tsx` → 1 match
- [ ] `rg "buildSmartCounterIndex" src/components/teams/ThreatMatchup.tsx` → no matches (only `getSmartCounterIndex`)
- [ ] `rg "suggest(Smart)?Counters\(" src/components/teams/ThreatMatchup.tsx` → no matches
- [ ] `pnpm exec tsc -b --pretty false` 0; `pnpm test` 0; `pnpm lint` 0
- [ ] Golden assertions in `smartCounters.test.ts` unchanged (`git diff src/lib/domain/smartCounters.test.ts` shows only additions)
- [ ] `release.ps1` exit 0 with artifact list
- [ ] `git status` shows only in-scope files
- [ ] `plans/README.md` status row for 008 updated

## STOP conditions

- Drift check non-empty and excerpts mismatch.
- Any existing golden test changes its expected numbers — the split must be
  behaviour-neutral; do not "fix" the expectation.
- The `opponents.map` JSX references parent state not listed in
  `OpponentCardProps` (search for `query`, `results`, `setQuery`, `setExtraTypes`
  inside the moved block) — add the prop if it is read-only, stop if it mutates
  parent state in a way not covered by the three callbacks.
- `pnpm lint` flags `react-hooks/exhaustive-deps` on the new memos and the fix
  would require depending on a value that changes every render — report rather
  than disabling the rule.
- Verification fails twice for the same step.

## Maintenance notes

- New scoring inputs (e.g. a future "format" filter) must be added to the
  `scoreCounters`/`scoreSmartCounters` memo dependency arrays in
  `OpponentCard`, or results will go stale.
- `getSmartCounterIndex` is keyed on the `sets.sets` array identity. If the
  dataset ever reloads Sets at runtime (settings toggle, update download), the
  new array yields a fresh index automatically; the old one is garbage-collected
  with the old array (WeakMap).
- Reviewers: verify every `OpponentCard` prop is stable across a `query`
  change (arrays/sets built in `useMemo`, callbacks in `useCallback`); a single
  inline arrow or fresh `new Set()` in the parent defeats the memo.
- Deferred: `TeamAnalysis` is already memoized; `suggestImprovementPlan` is
  still O(candidates²) but runs only on member changes — not a hot path.
