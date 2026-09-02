# Plan 005: Cut the boot critical path — fewer requests, less JSON, no dead work before the Dex paints

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0b6331f..HEAD -- index.html vite.config.ts src/lib/dataset/load.ts src/lib/dataset/load.test.ts src/lib/domain/types.ts tools/dataset/build.ts tools/sprites/manifest.ts public/sprites/manifest.json src-tauri/Cargo.toml`
> This plan was written against an **uncommitted working tree** on top of
> `0b6331f`. Compare every "Current state" excerpt below against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M (seven small independent steps)
- **Risk**: LOW
- **Depends on**: none. Best measured after Plan 004 (its probe script
  `tools/perf/startup-probe.ps1` is the gate here too). If 004 has not landed,
  create the probe from 004's Step 1 first — it is measurement-only.
- **Category**: perf
- **Planned at**: working tree over commit `0b6331f`, 2026-09-01

## Why this matters

Between the WebView's first frame and the Dex list appearing, the page fetches
and parses more than it needs, over Tauri's custom asset protocol where every
request is a round-trip into the Rust host:

- `index.html` starts **catalog.json (475 KB)** in the same wave as
  `dex.json` (427 KB) and the sprite manifest, although the Dex list never
  reads the catalog. It competes for the pipe with the JS the list needs.
- Applying the catalog runs `fillEnrichment` — a `defensiveProfile` for every
  one of ~1,380 Forms plus a `localeCompare` sort — and **nothing in `src/`
  reads the result** (`enrichment`, `nameIndex` have no production consumer).
  That is 5–30 ms of main-thread work right after first paint, followed by a
  `notifyDataset()` that re-renders every subscriber.
- The catalog carries `tierOverrides` and `formats` (~58 KB) that no runtime
  code reads (`emptyCore` stubs them and nobody looks again).
- `sets.json` + `learnsets.json` (2.7 MB) start two frames after the Dex
  paints, i.e. exactly while the first 20–25 still-PNG thumbs are requested.
- The build emits **7 modulepreload JS chunks + CSS** before React can boot
  (`manualChunks` splits `react`, `react-dom`, `router`, `virtual` — useful
  for browser caching, useless for an offline single-exe app), plus two
  favicon requests a Tauri window never shows.
- `public/sprites/manifest.json` is pretty-printed (94 KB; ~50 KB compact).
- `Cargo.toml` has no `[profile.release]` (no LTO, 16 codegen units, symbols kept).

None of these is large alone; together they are a plausible 60–150 ms off the
"UI visible" time on a warm start and less main-thread contention while the
user starts typing. Everything here is deletion or reordering — no new behavior.

## Current state

- `index.html:5-6` — favicon `<link>`s; `index.html:84-86` — early fetches:

```84:86:index.html
        window.__POKESTATS_DEX__ = getJson("/dataset/dex.json")
        window.__POKESTATS_CATALOG__ = getJson("/dataset/catalog.json")
        window.__POKESTATS_SPRITES__ = getJson("/sprites/manifest.json")
```

- `src/lib/dataset/load.ts` — loader. Relevant parts:

```18:38:src/lib/dataset/load.ts
export interface LoadedDataset {
  core: DatasetCore
  sets: DatasetSets
  learnsets: LearnsetsArtifact
  extrasReady: boolean
  catalogReady: boolean
  formsById: Map<string, Form>
  speciesById: Map<number, Species>
  enrichment: Map<string, { bst: number; defensive: Record<string, number> }>
  nameIndex: { slug: string; name: string; formId: string }[]
  movesByName: Map<string, MoveInfo>
  movesById: Map<string, MoveInfo>
  itemsByName: Map<string, ItemInfo>
  itemsById: Map<string, ItemInfo>
  abilitiesByName: Map<string, AbilityInfo>
  naturesByName: Map<string, NatureInfo>
}
```

```88:115:src/lib/dataset/load.ts
function fillEnrichment(forms: Form[]): {
  enrichment: LoadedDataset["enrichment"]
  nameIndex: LoadedDataset["nameIndex"]
} {
  // ... per-form BST + defensiveProfile + nameIndex.sort(localeCompare)
}

export function applyCatalog(indexed, catalog) {
  const { enrichment, nameIndex } = fillEnrichment(indexed.core.forms)
  return {
    ...indexed,
    core: { ...indexed.core, ...catalog },
    catalogReady: true,
    enrichment,
    nameIndex,
    movesByName: new Map(catalog.moves.map((m) => [m.name, m] as const)),
    // ... other maps
  }
}
```

```270:299:src/lib/dataset/load.ts
export async function loadDataset(): Promise<LoadedDataset> {
  if (cache) return cache
  if (coreInflight) return coreInflight

  coreInflight = (async () => {
    const started = performance.now()
    // Kick catalog in parallel with dex (HTML may already have it in flight).
    const catalogP = loadCatalogPayload(null)

    const { dex, coreFallback } = await loadDexPayload()
    cache = withExtras(indexDex(dex), { sets: [] }, {}, false)
    console.log(`[dataset] dex ${dex.forms.length} forms in ${(performance.now() - started).toFixed(1)}ms`)
    notifyDataset()

    const mergeCatalog = (catalog: DatasetCatalog | null) => { /* applyCatalog + notify */ }

    if (coreFallback) mergeCatalog(coreFallback)
    else void catalogP.then(mergeCatalog).catch((e) => console.warn("[dataset] catalog", e))

    await yieldToPaint()
    scheduleAfterPaint(() => {
      void ensureExtras()
    })
    return cache
  })()
```

  `indexDex` (line 74) sets `enrichment: new Map(), nameIndex: []`.
  `import { defensiveProfile, TYPE_NAMES } from "@/lib/domain/typeChart"` (line 15) —
  `defensiveProfile` is used only by `fillEnrichment`; `TYPE_NAMES` is used by `resolveMoveInfo`.

- `src/lib/dataset/load.test.ts` — asserts `enrichment` at lines 63 and 75–81:

```75:81:src/lib/dataset/load.test.ts
  it("builds formsById and enrichment BST as the sum of six stats", () => {
    const indexed = indexCore(core)
    expect(indexed.formsById.get("charizard")?.name).toBe("Charizard")
    expect(indexed.formsById.get("charizardmegax")?.isBaseForm).toBe(false)
    expect(indexed.catalogReady).toBe(true)
    expect(indexed.enrichment.get("charizard")?.bst).toBe(78 + 84 + 78 + 109 + 85 + 100)
  })
```

- `src/lib/domain/types.ts:217-227` — `DatasetCatalog` has `tierOverrides: TierEntry[]`
  and `formats: FormatMeta[]`; `DatasetCore = DatasetDex & DatasetCatalog` (line 229).
  Production `src/` never reads `.tierOverrides` or `.formats` (verified with
  `rg "tierOverrides|\.formats\b" src` → only `types.ts:218`, `load.ts:48`,
  `load.test.ts:35`).
- `tools/dataset/build.ts:579-588` — the shipped catalog object:

```579:588:tools/dataset/build.ts
  const catalog = {
    tierOverrides: core.tierOverrides,
    baseStatOverrides: core.baseStatOverrides,
    typeOverrides: core.typeOverrides,
    formats: core.formats,
    moves: core.moves,
    items: core.items,
    abilities: core.abilities,
    natures: core.natures,
  }
```

- `vite.config.ts:19-28` — `manualChunks` for `react-dom`, `react`, `router`, `virtual`.
  Built `dist/index.html` today: 1 `<script type="module">` + 7 `modulepreload` + 1 CSS.
- `tools/sprites/manifest.ts:81` — `writeFileSync(SPRITE_MANIFEST_PATH, \`${JSON.stringify(out, null, 2)}\n\`)`.
  `public/sprites/manifest.json` is tracked in git (94 KB).
- `src-tauri/Cargo.toml` — ends after `[dependencies]`; no `[profile.release]`.

Conventions: `load.ts` logs `[dataset] <stage> <ms>` — keep that style. Tests
use inline fixtures (`load.test.ts`), no JSON imports.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm exec tsc -b --pretty false` | exit 0 |
| Tests | `pnpm test` | all pass |
| Lint | `pnpm lint` | exit 0 |
| Dataset rebuild | `pnpm run dataset:build` | prints `[dataset:build] wrote … forms` and byte sizes |
| Frontend build | `pnpm run build` | exit 0; writes `dist/` |
| Rust check | `cargo check --manifest-path src-tauri/Cargo.toml` | exit 0 |
| Ship gate | `powershell -ExecutionPolicy Bypass -File .\release.ps1` | exit 0 + artifact list |
| Probe | `powershell -ExecutionPolicy Bypass -File .\tools\perf\startup-probe.ps1 -Runs 5` | `SUMMARY` lines |

## Scope

**In scope**:

- `index.html`
- `src/lib/dataset/load.ts`, `src/lib/dataset/load.test.ts`
- `src/lib/domain/types.ts` (only removing two fields from `DatasetCatalog`)
- `tools/dataset/build.ts` (only the `catalog` object)
- `vite.config.ts`
- `tools/sprites/manifest.ts`, `public/sprites/manifest.json` (re-save compact)
- `src-tauri/Cargo.toml`
- `plans/README.md`

**Out of scope**:

- `src-tauri/src/lib.rs` (Plan 004).
- `src/lib/i18n.tsx` — splitting the idle locale was evaluated and rejected
  (an extra chunk request costs more than parsing ~20 KB).
- Splitting `desc` text out of moves/items or slimming `dex.json` — deferred
  (see `plans/README.md`); do not start it here.
- Any change to sprite components or routes.
- `tools/dataset/fetch.ts` / fixtures — the build reads committed fixtures; do
  not touch the fetcher.

## Git workflow

- Branch: `advisor/005-boot-critical-path-diet`.
- One commit per step is fine; suggested messages:
  `perf(boot): defer catalog.json until after the Dex paints`,
  `perf(dataset): drop unused enrichment/nameIndex and dead catalog arrays`,
  `perf(build): single vendor chunk, no favicons, compact sprite manifest`,
  `build(tauri): add release profile (thin LTO, strip)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove favicons and the catalog early-fetch from `index.html`

- Delete lines 5–6 (`<link rel="icon" ...>` ×2).
- Delete the line `window.__POKESTATS_CATALOG__ = getJson("/dataset/catalog.json")`.
  Keep `__POKESTATS_DEX__` and `__POKESTATS_SPRITES__`.

`load.ts` already tolerates a missing early promise: `takeEarly("__POKESTATS_CATALOG__")`
returns `null` and `loadCatalogPayload` falls back to `fetchJson("/dataset/catalog.json")`.
Also delete the `__POKESTATS_CATALOG__` key from the `EarlyWindow` type and
the `takeEarly` key union in `load.ts` (lines 40–43 and 209), and simplify
`loadCatalogPayload` to `return coreFallback ?? fetchJson("/dataset/catalog.json")`.

**Verify**: `pnpm exec tsc -b --pretty false` → exit 0.
`rg "favicon|__POKESTATS_CATALOG__" index.html src` → no matches.

### Step 2: Start the catalog after first paint, and extras at idle

In `loadDataset()`:

1. Move `const catalogP = loadCatalogPayload(null)` from before
   `await loadDexPayload()` to **after** `await yieldToPaint()` (the line that
   already exists below `mergeCatalog`). Keep the `coreFallback` branch
   (when `core.json` was the fallback payload, merge immediately as today).
2. Replace `scheduleAfterPaint(() => { void ensureExtras() })` with: after the
   catalog promise settles (`.finally`), schedule extras on idle:

```ts
const scheduleIdle = (fn: () => void) => {
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (typeof ric === "function") ric(fn, { timeout: 1500 })
  else setTimeout(fn, 300)
}
// after first paint:
const catalogP = loadCatalogPayload(null)
void catalogP
  .then(mergeCatalog)
  .catch((e) => console.warn("[dataset] catalog", e))
  .finally(() => scheduleIdle(() => { void ensureExtras() }))
```

   Delete `scheduleAfterPaint` if nothing else uses it (`rg scheduleAfterPaint src`).

   Behavior contract (unchanged for consumers): `loadDataset()` still resolves
   at dex-ready; `catalogReady` flips a little later than today; `extrasReady`
   flips after that. Pages already gate on both flags (Plan 003).

**Verify**: `pnpm test` → all pass. `pnpm dev`, open the app in a browser,
console shows `[dataset] dex … ms`, then `[dataset] catalog … ms`, then
`[dataset] extras … ms` in that order.

### Step 3: Delete `fillEnrichment`, `enrichment`, `nameIndex`

In `load.ts`:

- Remove `enrichment` and `nameIndex` from `LoadedDataset`.
- Remove the two fields from `indexDex`'s return object.
- Delete `fillEnrichment` and its call in `applyCatalog` (and the two fields
  from `applyCatalog`'s return).
- Change the import to `import { TYPE_NAMES } from "@/lib/domain/typeChart"`.

In `load.test.ts`:

- Line 63: delete `expect(dex.enrichment.size).toBe(0)`.
- Lines 75–81: rename the test to `"indexCore builds formsById and marks catalog ready"`
  and delete the `enrichment` assertion.

**Verify**: `rg "enrichment|nameIndex" src` → no matches.
`pnpm exec tsc -b --pretty false` → exit 0. `pnpm test` → all pass (105 tests: one assertion removed, no test removed).

### Step 4: Drop `tierOverrides` and `formats` from the shipped catalog

- `tools/dataset/build.ts:579-588`: remove the `tierOverrides` and `formats`
  lines from the `catalog` object. Leave `core.json` (written with the full
  `core`) untouched — `prune-dist` strips it from `dist/` anyway.
- `src/lib/domain/types.ts`: remove `tierOverrides: TierEntry[]` and
  `formats: FormatMeta[]` from `DatasetCatalog`. If `TierEntry`/`FormatMeta`
  become unused exports, leave the types in place (other tools may import them)
  unless `tsc` flags an unused *local*.
- `src/lib/dataset/load.ts` `emptyCore`: remove `tierOverrides: []` and `formats: []`.
- `src/lib/dataset/load.test.ts:35,38`: remove the two fixture lines.

If `tools/dataset/build.ts` builds a typed `core` object whose type requires
those fields (it may use `DatasetCore` from `types.ts`), keep them on the
`core` type by introducing `DatasetCoreFile = DatasetCore & { tierOverrides: TierEntry[]; formats: FormatMeta[] }`
inside `build.ts` only. Do not put them back into `DatasetCatalog`.

**Verify**: `pnpm run dataset:build` → prints sizes; `catalog.json` bytes must
be ≥ 50,000 smaller than before (record both numbers in your report).
`pnpm exec tsc -b --pretty false` → 0; `pnpm test` → all pass.

### Step 5: One boot chunk, compact manifest

- `vite.config.ts`: delete the whole `rollupOptions.output.manualChunks`
  block (keep `build.target`, `minify`, `sourcemap`). Route chunks remain
  lazy via `React.lazy` in `src/App.tsx`.
- `tools/sprites/manifest.ts:81`: change to
  `writeFileSync(SPRITE_MANIFEST_PATH, \`${JSON.stringify(out)}\n\`)`.
- Re-save the committed manifest compactly **without** fetching anything:
  `node -e "const fs=require('fs');const p='public/sprites/manifest.json';fs.writeFileSync(p, JSON.stringify(JSON.parse(fs.readFileSync(p,'utf8')))+'\n')"`

**Verify**: `pnpm run build` → exit 0. Then:
`Select-String -Path dist\index.html -Pattern "modulepreload" | Measure-Object | Select-Object -ExpandProperty Count`
→ ≤ 2 (was 7). `(Get-Item public\sprites\manifest.json).Length` → < 60,000 (was 93,704).
`pnpm test` → all pass (`src/lib/sprites*.test.ts` read the manifest shape, not its formatting).

### Step 6: Release profile

Append to `src-tauri/Cargo.toml`:

```toml
[profile.release]
opt-level = 3
lto = "thin"
codegen-units = 1
panic = "abort"
strip = true
```

**Verify**: `cargo check --manifest-path src-tauri/Cargo.toml` → exit 0
(profile settings are validated at parse time).

### Step 7: Ship gate and measurement

Run `release.ps1` → exit 0. Run the probe (5 runs) and compare the median
`ui` against the most recent baseline (Plan 004's Step 6 result if 004
landed; otherwise a 5-run baseline you take **before Step 1** with the
previous release exe — take it now if you have not).

**Verify**: median `ui` improves by ≥ 30 ms and `blackFrames` is unchanged
(0 if 004 landed). If `ui` did not improve, the plan is still correct
(deletions of dead work), but report the two medians in the status row.

## Test plan

- Existing `src/lib/dataset/load.test.ts` updated as in Steps 3–4 (no test
  removed; two assertions removed; fixture shrinks).
- Add one test to `load.test.ts`: `applyCatalog` result has no `enrichment`
  key: `expect("enrichment" in applyCatalog(indexDex(core), core)).toBe(false)`.
- Verification: `pnpm test` → all pass.

## Done criteria

ALL must hold:

- [ ] `rg "favicon|__POKESTATS_CATALOG__|enrichment|nameIndex|scheduleAfterPaint" index.html src` → no matches
- [ ] `rg "tierOverrides|formats:" src/lib/domain/types.ts src/lib/dataset/load.ts` → no matches
- [ ] `rg "manualChunks" vite.config.ts` → no matches; `dist/index.html` has ≤ 2 `modulepreload` links after `pnpm run build`
- [ ] `public/sprites/manifest.json` < 60,000 bytes and `tools/sprites/manifest.ts` writes compact JSON
- [ ] `src-tauri/Cargo.toml` has `[profile.release]` with `lto`, `codegen-units = 1`, `strip = true`
- [ ] `pnpm exec tsc -b --pretty false` 0; `pnpm test` 0; `pnpm lint` 0; `cargo check` 0
- [ ] `release.ps1` exit 0 with artifact list
- [ ] Probe: `blackFrames` not worse than before; median `ui` reported in `plans/README.md` status
- [ ] `git status` shows only in-scope files
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

- Excerpts drifted (especially `LoadedDataset` or the `loadDataset` body).
- `rg "\.enrichment|\.nameIndex|tierOverrides|\.formats\b" src` finds a
  production consumer this plan says does not exist — stop; the audit was wrong.
- After Step 5 the app fails to start or a route shows the `PageFallback`
  forever (a chunk failed to load) — check the browser console in `pnpm dev`
  and report; do not re-add `manualChunks` piecemeal.
- `release.ps1` fails on the Rust link step after Step 6 — try once with
  `lto = false` removed entirely (i.e. delete the profile) to confirm it is the
  profile, then report.
- Verification fails twice for the same step.

## Maintenance notes

- Anyone adding a field to `catalog.json` should ask "who reads this at
  runtime?" — the dead arrays removed here existed because nobody did.
- The order dex → paint → catalog → idle extras is now explicit in
  `loadDataset`. A future feature that needs the catalog *on* the Dex list
  (e.g. a move column) must accept `catalogReady === false` for ~100 ms or move
  the data into `dex.json` at build time.
- If a browser build is ever shipped, re-add the favicons behind a build flag.
- Deferred, in `plans/README.md`: `desc` text split (moves 125 KB, items 38 KB)
  and `dex.json` list projection (~100 KB). Revisit only if the probe still
  shows `ui − shell` > 450 ms after 004+005.
