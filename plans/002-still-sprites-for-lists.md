# Plan 002: Serve still PNGs in lists; keep ani GIFs for Form detail

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat HEAD -- src/lib/sprites.ts src/lib/sprites.test.ts src/components/ui/sprite.tsx tools/sprites/fetch.ts public/sprites/README.md .gitignore`
> If plan 001 is not DONE, STOP (this plan assumes `spriteUrls` and the manifest schema from 001).
> If any in-scope file changed vs the 001 target design, compare before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-local-sprite-manifest.md
- **Category**: perf
- **Planned at**: working tree 2026-08-30 (no short SHA recorded; treat excerpt mismatch as drift)

## Why this matters

Even after plan 001 stops the CDN cascade, the Dex still paints **animated Showdown GIFs** in an 18–28 px cell (`SpriteThumb` in `src/routes/dex.tsx`, tab chrome in `TabBar.tsx`). Each file is typically 10–80 KB of LZW animation. The WebView decodes animation for every visible row. That is wasted work at list size, and bundling ~154 MB of `ani/` into the `.exe` (documented in `public/sprites/README.md`) makes install and first unpack heavier than the list needs.

The intelligent split: **gen5-class still PNG** for thumbs (and as fallback when ani is missing); **ani GIF only for `Sprite` size md+ and the lightbox**. Fetch both at build time. Lists stay offline and cheap; Form detail can still show the animated sprite the product advertised.

## Current state (after 001)

Plan 001's contract that this plan extends:

- Manifest: `{ version: 1, forms: { [formId]: { still?: boolean, ani?: boolean } } }`
- `spriteUrls(form, kind, base, manifest)` currently treats `"thumb"` and `"full"` the same: local `/sprites/ani/<id>.gif` only.
- `tools/sprites/fetch.ts` downloads Showdown/Smogon/gen5 candidates into `public/sprites/ani/<id>.gif` (PNG bytes may be stored under `.gif`). Writes/merges `public/sprites/manifest.json`.
- UI: `SpriteThumb` → `kind: "thumb"`; `Sprite` and lightbox → `kind: "full"`.
- `.gitignore` ignores `public/sprites/ani/*.gif` and `*.png`.

`src/routes/dex.tsx` uses `<SpriteThumb form={f} />` at default size 28. `src/components/layout/TabBar.tsx` uses `<SpriteThumb form={form} size={18} expandable={false} />`. `src/routes/formDetail.tsx` uses `<Sprite form={form} size="md" />`. `src/routes/compare.tsx` uses `<Sprite form={f} size="lg" />`.

Vocabulary: **Form** / FormId slug paths stay `/sprites/still/<id>.png` and `/sprites/ani/<id>.gif`.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Tests     | `pnpm test -- src/lib/sprites.test.ts` | all pass (including new still/kind cases) |
| Full tests | `pnpm test` | all pass |
| Lint      | `pnpm lint` | exit 0 |
| Typecheck | `pnpm exec tsc -b --pretty false` | exit 0 |

## Suggested executor toolkit

- None. Do not run a full `pnpm sprites:fetch` against the CDN unless the operator asks. A `--limit 1 --dry` read of the URL list is enough to confirm candidate order.

## Scope

**In scope**:

- `src/lib/sprites.ts` (`spriteUrls` kind branching only)
- `src/lib/sprites.test.ts`
- `src/components/ui/sprite.tsx` — only if something still bypasses `kind` (should not need layout changes)
- `tools/sprites/fetch.ts`
- `public/sprites/still/.gitkeep` (create)
- `public/sprites/README.md`
- `.gitignore` — ignore `public/sprites/still/*.png` like ani blobs
- `src/lib/i18n.tsx` — `compare.spriteNote` if it still says the list ships 154 MB GIFs only
- `plans/README.md` (status)

**Out of scope**:

- Replacing ani GIFs entirely (product still wants animation on Form detail)
- WebP conversion, sprite atlases, CSS image-set
- `src/lib/dataset/load.ts` (plan 003)
- Changing Dex virtualizer `overscan`
- Committing PNG/GIF binaries
- Remote URLs in `src/` (must remain zero after 001)

## Git workflow

- Branch: `advisor/002-still-sprites-for-lists` (or current operator branch).
- Commit message: `Load still PNGs in Dex thumbs; keep ani GIFs for Form detail.`
- Do NOT push or open a PR unless the operator instructed it.

## Target design

### Files on disk

| Role | Path | Manifest flag |
|------|--------|----------------|
| List / tab / 18–28 px | `/sprites/still/<formId>.png` | `still: true` |
| Form detail, compare, lightbox | `/sprites/ani/<formId>.gif` | `ani: true` |

Create `public/sprites/still/.gitkeep`. Gitignore:

```
public/sprites/still/*.png
!public/sprites/still/.gitkeep
```

### `spriteUrls` preference (local only)

Let `own = manifest.forms[form.id]`, `baseEntry = base ? manifest.forms[base.id] : undefined`.

**`kind === "thumb"`** (order, skip missing flags):

1. If `own?.still` → `/sprites/still/${form.id}.png`
2. Else if `own?.ani` → `/sprites/ani/${form.id}.gif`
3. Else if `base` and `baseEntry?.still` → still of base; mark `baseFallbackUrls`
4. Else if `base` and `baseEntry?.ani` → ani of base; mark `baseFallbackUrls`

**`kind === "full"`**:

1. If `own?.ani` → `/sprites/ani/${form.id}.gif`
2. Else if `own?.still` → `/sprites/still/${form.id}.png`
3. Else base ani, then base still, each marked in `baseFallbackUrls`

Never more than these local paths. Never `https://`.

### Fetch tool

Extend `candidatesFor` into two download goals **per Form**:

1. **still** — prefer Showdown gen5 PNG (`https://play.pokemonshowdown.com/sprites/gen5/${showdown}.png`, then alias). Save to `public/sprites/still/<id>.png` only if the buffer is PNG magic (`0x89 0x50`). If the only hit is a GIF, do **not** write it as a still (leave `still` unset; thumb will fall back to ani per the rules above).
2. **ani** — keep today's GIF-first candidate list, write `public/sprites/ani/<id>.gif` as today.

Concurrency: still allowed to reuse `CONCURRENCY = 8`. Per Form, fetch still then ani (or skip if file exists, same size>500 skip logic as today). Do not download stills from PokeAPI in this plan (one source: Showdown gen5), so the tool stays simpler and naming stays on `showdownAlias`.

Manifest write: set `still` / `ani` independently from files that exist. Full fetch (no `--limit`): scan both `still/` and `ani/` dirs. `--limit`: merge flags for those FormIds only.

Skip existing files independently (have still, missing ani → only fetch ani).

`--dry` prints both still and ani candidate URLs; writes nothing.

## Steps

### Step 1: Kind-aware `spriteUrls` + tests

Update `src/lib/sprites.ts` and add cases to `src/lib/sprites.test.ts`:

1. Thumb + both flags → only still URL.
2. Full + both flags → only ani URL.
3. Thumb, still missing, ani present → ani URL (degraded thumb).
4. Full, ani missing, still present → still URL.
5. Thumb, neither own, base has still → base still in list and in `baseFallbackUrls`.
6. No https in lists.

**Verify**: `pnpm test -- src/lib/sprites.test.ts` → all pass.

### Step 2: Fetch stills + gitignore + README

Implement still output dir, skip/merge/manifest as above. Update README: list cells use still; detail uses ani; both are opt-in via `pnpm sprites:fetch`; gzip note applies to ani; stills are much smaller.

Update `compare.spriteNote` (en + pt-BR) to mention stills for lists and ani for detail.

`sprite.tsx` should already pass `kind`; if a call site still uses a deleted helper, STOP.

**Verify**: `pnpm exec tsc -b --pretty false` → 0. `pnpm lint` → 0. `rg "play.pokemonshowdown.com" src` → no matches.

## Test plan

- Extend `src/lib/sprites.test.ts` only (node vitest).
- Do not add a network test for fetch.ts.
- Pattern: existing cases from 001 plus the six above.

Verification: `pnpm test` → all pass.

## Done criteria

- [ ] Plan 001 is DONE (manifest + `spriteUrls` exist)
- [ ] `pnpm exec tsc -b --pretty false` exits 0
- [ ] `pnpm test` exits 0 with the new kind/still cases
- [ ] `pnpm lint` exits 0
- [ ] `.gitignore` ignores `public/sprites/still/*.png`
- [ ] `public/sprites/still/.gitkeep` exists
- [ ] `rg "https://" src/lib/sprites.ts` returns no matches
- [ ] No GIF/PNG binaries added; no files outside scope (`git status`)
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

- Plan 001 is not implemented (`spriteUrls` missing).
- Excerpts / 001 contract drifted and you cannot map `kind` without rewriting UI from scratch — report.
- You are about to convert all sprites to WebP or drop ani entirely.
- Verification fails twice.
- Fetch would need a second CDN (PokeAPI) to get stills — do not add it; leave `still` unset.

## Maintenance notes

- Operators must re-run `pnpm sprites:fetch` to populate `still/`. Empty still dir + ani-only manifest still works (thumbs use GIF until stills exist).
- Reviewers: check fetch does not write GIF bytes to `still/*.png`.
- Deferred: shrinking the shipped `ani/` folder (optional later: omit ani from the Tauri bundle and keep stills only). Not this plan.
