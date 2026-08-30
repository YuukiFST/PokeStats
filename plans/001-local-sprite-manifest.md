# Plan 001: Resolve sprites only from a local manifest (no CDN waterfall)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat HEAD -- src/lib/sprites.ts src/components/ui/sprite.tsx tools/sprites/fetch.ts public/sprites/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: working tree 2026-08-30 (no short SHA recorded; treat excerpt mismatch as drift)

## Why this matters

The Dex list virtualizes rows, but each `Sprite` / `SpriteThumb` still points `<img>` at `/sprites/ani/<id>.gif` and, on `onError`, walks up to ~10 remote Showdown / Smogon / PokeAPI URLs in series. GIF blobs are gitignored; a clone without `pnpm sprites:fetch` (and any Form whose file is missing) pays a 404 plus a CDN cascade per visible cell. That is the main reason Pokémon images feel slow, and it contradicts the product rule that the app is 100% offline at runtime.

The intelligent fix is not HEAD-probing and not keeping remotes as a "backup". It is a **tiny committed manifest** that lists which FormIds actually have files on disk. The `<img src>` is set only to a path the manifest claims exists. Missing art becomes the existing dashed placeholder immediately. Plan 002 will add still PNGs; this plan's types already reserve a `still` flag so 002 does not rewrite the schema.

## Current state

- `src/lib/sprites.ts` — candidate URL builder. Always pushes local GIF then many `https://` URLs.
- `src/components/ui/sprite.tsx` — `Sprite`, `SpriteThumb`, `SpriteLightbox` walk `candidates[index]` on `onError`. Lightbox also `fetch`es `https://pokeapi.co/api/v2/pokemon/...` when opened.
- `tools/sprites/fetch.ts` — download tool; writes `public/sprites/ani/<id>.gif` (or PNG bytes under a `.gif` name). Does not write a manifest.
- `public/sprites/README.md` — documents local-first then remote CDN fallback.
- `.gitignore` — `public/sprites/ani/*.gif` and `*.png`; keep dir via `.gitkeep`.
- Product vocabulary (`CONTEXT.md`): **Form** is the stat-bearing variant keyed by slug FormId (`charizardmegax`). Sprite paths must keep using FormId, not display names.

Excerpt — remote chain (do not keep this as the runtime default):

```36:63:src/lib/sprites.ts
  // 1. Local bundled (tools/sprites/fetch.ts saves as <id>.gif regardless of remote name)
  candidates.push(`/sprites/ani/${id}.gif`)

  // 2. Remote Showdown ani — try id, showdown alias, alias (dedupe)
  const remote = new Set<string>()
  remote.add(`https://play.pokemonshowdown.com/sprites/ani/${id}.gif`)
  remote.add(`https://play.pokemonshowdown.com/sprites/ani/${showdown}.gif`)
  if (alias !== showdown) remote.add(`https://play.pokemonshowdown.com/sprites/ani/${alias}.gif`)
  // ...
  for (const u of remote) candidates.push(u)
  // 3. Smogon ... 4. gen5 PNG ... 5. PokeAPI ...
  return [...new Set(candidates)]
```

Excerpt — error walk + eager thumbs:

```271:321:src/components/ui/sprite.tsx
      onError={() => {
        if (index + 1 < candidates.length) setIndex((i) => i + 1)
        else setFailed(true)
      }}
    />
  )
  // ...
      loading="eager"
      onError={() => (idx + 1 < candidates.length ? setIdx(idx + 1) : setFail(true))}
```

Excerpt — lightbox network (must go):

```83:107:src/components/ui/sprite.tsx
  // Fetch HD via PokeAPI official-artwork ...
        const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${a}`)
```

Conventions:

- Domain unit tests: `src/lib/workspace/state.test.ts` and `src/lib/domain/moveset.test.ts` — Vitest, `describe`/`it`/`expect`, no DOM. New sprite tests go in `src/lib/sprites.test.ts` the same way.
- `package.json` scripts: `pnpm test` → `vitest run`; `pnpm lint` → `oxlint`. Typecheck: `pnpm exec tsc -b --pretty false` (app tsconfig has `"noEmit": true`).
- Do not invent a settings toggle for "allow remote sprites". Offline is the product.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Tests     | `pnpm test` | all pass, including new `sprites.test.ts` |
| Tests (filter) | `pnpm test -- src/lib/sprites.test.ts` | all pass |
| Lint      | `pnpm lint` | exit 0 |
| Typecheck | `pnpm exec tsc -b --pretty false` | exit 0, no errors |

## Suggested executor toolkit

- None required. Do not run `pnpm sprites:fetch` against the real CDN unless the operator asks; tests inject a manifest object in memory.

## Scope

**In scope** (the only files you should modify):

- `src/lib/sprites.ts`
- `src/lib/sprites.test.ts` (create)
- `src/components/ui/sprite.tsx`
- `tools/sprites/fetch.ts`
- `public/sprites/manifest.json` (create; committed)
- `public/sprites/README.md`
- `src/lib/i18n.tsx` — only the two `compare.spriteNote` / `sprite.baseFallback` strings if they still claim CDN fallback
- `plans/README.md` (status row)

**Out of scope**:

- `src/routes/dex.tsx` virtualizer, overscan, or row layout
- Still PNG pipeline / `public/sprites/still/` — that is plan 002. You may add a `still?: boolean` field on the manifest type and ignore it in the resolver until 002.
- `src/lib/dataset/load.ts` (plan 003)
- `src/App.tsx` route splitting
- Tauri / `src-tauri/**`
- Downloading or committing GIF/PNG blobs
- Changing FormId slug rules

## Git workflow

- Branch: `advisor/001-local-sprite-manifest` if you are on a clean branch of your own; otherwise commit on the current working branch if the operator already placed you there.
- Commit message style (imperative, why): `Stop probing CDNs for Form sprites; resolve only from the local manifest.`
- Do NOT push or open a PR unless the operator instructed it.

## Target design (do not improvise a different one)

### Manifest on disk

Commit `public/sprites/manifest.json`:

```json
{
  "version": 1,
  "forms": {}
}
```

After `pnpm sprites:fetch`, the same file is rewritten, e.g.:

```json
{
  "version": 1,
  "forms": {
    "charizard": { "ani": true },
    "charizardmegax": { "ani": true }
  }
}
```

`forms` keys are FormIds. `ani: true` means `public/sprites/ani/<id>.gif` exists and is the file the UI may request. `still` is reserved for plan 002 (`public/sprites/still/<id>.png`).

If `sprites:fetch` finds zero Forms (empty core), still write `{ "version": 1, "forms": {} }`.

### Runtime API in `src/lib/sprites.ts`

Keep `formToAlias` and `showdownAliasFromName` (fetch.ts and tests still need aliases for **build-time** download URLs).

Replace the runtime candidate lists used by the UI with:

```ts
export type SpriteKind = "thumb" | "full"

export interface SpriteManifest {
  version: number
  forms: Record<string, { still?: boolean; ani?: boolean }>
}

export function setSpriteManifestForTests(m: SpriteManifest | null): void
export function getSpriteManifestSync(): SpriteManifest | null
export async function loadSpriteManifest(): Promise<SpriteManifest>

export function spriteUrls(
  form: { id: string; name: string; isBaseForm?: boolean },
  kind: SpriteKind,
  base: SpriteBase | undefined,
  manifest: SpriteManifest,
): { list: string[]; baseFallbackUrls: Set<string> }
```

`loadSpriteManifest` fetches `/sprites/manifest.json` once (same inflight/cache pattern as `src/lib/dataset/load.ts`). On 404 or JSON error, cache `{ version: 1, forms: {} }` — never throw. Call it from `sprite.tsx` on module init (`typeof window !== "undefined"`) the same way `load.ts` preloads the dataset.

`spriteUrls` rules (plan 001, `still` unused):

1. If `manifest.forms[form.id]?.ani`, first URL is `/sprites/ani/${form.id}.gif`.
2. Else if the Form is not base and `base` is set and `manifest.forms[base.id]?.ani`, append `/sprites/ani/${base.id}.gif` and add that URL to `baseFallbackUrls`.
3. Never emit `http:` or `https:` URLs.
4. `kind` is unused in 001 except that both `"thumb"` and `"full"` follow the same ani rule. Plan 002 will branch on `kind`. Do not delete the parameter.

Remove `getOwnSpriteCandidates`, `getSpriteCandidates`, and `getHighResCandidates` from the **UI import graph**. If you keep them as unused exports, oxlint/tsc `noUnusedLocals` may not care, but `sprite.tsx` must not import them. Prefer deleting them so `grep` in Done criteria is honest. **Keep alias helpers.** Fetch tool has its own `candidatesFor` for downloads — that may still use remote URLs; that is build-time, not the app.

### UI in `sprite.tsx`

- Load manifest via `getSpriteManifestSync()`; if null, `list` is empty → existing placeholder (do not start a CDN walk).
- `Sprite` and `SpriteThumb` call `spriteUrls(..., "full" | "thumb", ...)`.
- `onError`: if there is a next local URL, advance; else placeholder. With a correct manifest this should almost never fire.
- Delete the PokeAPI `useEffect` in `SpriteLightbox`. Lightbox `<img>` uses the same local `spriteUrls(..., "full")` list (ani GIF scaled to 320px is acceptable until 002). No `getHighResCandidates`. No `pokeHD` state.
- `SpriteThumb` `loading`: change `"eager"` to `"lazy"`. The Dex virtualizer already unmounts off-screen rows; eager was amplifying the waterfall.

### Fetch tool

At the end of a successful `main()` (including `--limit` and including the all-skip path), write `public/sprites/manifest.json` from files that exist on disk:

- For each Form in the (possibly limited) list, if `public/sprites/ani/<id>.gif` exists and size > 500, set `forms[id].ani = true`.
- When `--limit` is used, **merge** into any existing manifest instead of wiping unrelated ids (read existing JSON if present). When running the full fetch (no `--limit`), rewrite the whole `forms` object from disk scan of `OUT_DIR` so stale ids disappear.

`--dry` must not write the manifest.

## Steps

### Step 1: Add `spriteUrls` + tests with an injected manifest

Implement `setSpriteManifestForTests` / `spriteUrls` in `src/lib/sprites.ts`. Create `src/lib/sprites.test.ts` modeled on `src/lib/workspace/state.test.ts`.

Cases:

1. Empty manifest → `list` is `[]` for a base Form.
2. `ani: true` on the Form → exactly `["/sprites/ani/charizard.gif"]`, `baseFallbackUrls` empty.
3. Missing own ani, base Form has ani → list is the base GIF only, URL is in `baseFallbackUrls`.
4. No `https://` substring in any returned URL (assert with `list.every(...)`).
5. Unknown FormId with a populated manifest of other ids → empty list.

**Verify**: `pnpm test -- src/lib/sprites.test.ts` → all pass.

### Step 2: Wire `sprite.tsx` to the manifest; delete CDN + PokeAPI

Switch `Sprite` / `SpriteThumb` / `SpriteLightbox`. Preload manifest on module init. Empty list → existing placeholder UI (do not change placeholder styling).

Update `compare.spriteNote` (en + pt-BR) to say sprites are local files listed in `public/sprites/manifest.json` after `pnpm sprites:fetch`; missing FormIds show a placeholder; the app does not request CDNs at runtime.

Update `sprite.baseFallback` to say the Base Form's **bundled** sprite is showing, not "CDN".

**Verify**: `pnpm exec tsc -b --pretty false` → exit 0. `rg "play.pokemonshowdown.com|smogon.com/dex/media|pokeapi.co|pokemondb.net|githubusercontent.com/PokeAPI" src` → no matches (`tools/sprites/fetch.ts` may still contain those hosts).

### Step 3: Manifest file + fetch writer + README

Create `public/sprites/manifest.json` with empty `forms`. Teach `tools/sprites/fetch.ts` to write/merge it as specified. Update `public/sprites/README.md`: offline resolution is manifest-driven; remote URLs exist only inside the fetch tool.

**Verify**: `pnpm lint` → exit 0. `pnpm test` → all pass.

## Test plan

- New: `src/lib/sprites.test.ts` (cases in Step 1).
- No component/DOM tests (vitest env is `node` — `vitest.config.ts`). Do not add jsdom.
- After Step 2, grep in Done criteria is the regression test for CDN URLs in `src/`.

Verification: `pnpm test` → all pass, including the new file.

## Done criteria

- [ ] `pnpm exec tsc -b --pretty false` exits 0
- [ ] `pnpm test` exits 0; `src/lib/sprites.test.ts` exists and passes
- [ ] `pnpm lint` exits 0
- [ ] `rg "play.pokemonshowdown.com|smogon.com/dex/media|pokeapi.co" src` returns no matches
- [ ] `public/sprites/manifest.json` is committed with `"version": 1` and `"forms": {}` (or populated only if the operator already has blobs — do not add GIF binaries)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" no longer match `sprites.ts` / `sprite.tsx`.
- A step's verification fails twice after a reasonable fix attempt.
- You believe the app cannot ship without remote fallback (it can: placeholder is the existing failure UI).
- `oxlint` or `tsc` requires changing files outside scope.
- You are about to commit sprite GIF/PNG binaries.

## Maintenance notes

- Plan 002 will set `still: true` and make `kind === "thumb"` prefer `/sprites/still/<id>.png`. Do not special-case stills here beyond allowing the field on the type.
- Reviewers: confirm no `https://` remains under `src/` for sprites; fetch-tool remotes are OK.
- If a future Form has art that is not a GIF, still record it as `ani: true` only if the file served at `/sprites/ani/<id>.gif` exists (browser sniffs PNG bytes). Do not invent a third extension in this plan.
