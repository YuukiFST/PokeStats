# Sprites

Local cache so the app works fully offline. Runtime resolution is **manifest-driven**: `src/lib/sprites.ts` only emits paths for FormIds listed in `public/sprites/manifest.json`. Missing FormIds show the existing placeholder. Remote CDN URLs exist only inside `tools/sprites/fetch.ts` (build-time download).

| Role | Path | Manifest flag |
|------|------|----------------|
| List / tab thumbs (18–28 px) | `/sprites/still/<FormId>.png` | `still: true` |
| Form detail, compare, lightbox | `/sprites/ani/<FormId>.gif` | `ani: true` |

- Still source (fetch tool only): Showdown gen5 PNG `https://play.pokemonshowdown.com/sprites/gen5/<alias>.png`. GIF bytes are never written as stills.
- Ani source (fetch tool only): Showdown `ani/` then Smogon `xy/` then gen5 PNG stored as `/sprites/ani/<FormId>.gif` (browser sniffs PNG bytes if needed). ~154 MB front GIFs; `gzip -9` saves only ~2%.
- Naming: `tools/sprites/fetch.ts` resolves `Form.name` → Showdown alias and saves as `<FormId>.gif` / `<FormId>.png` where FormId is the canonical slug (`charizardmegax`).
- Manifest: flags come from files on disk (size > 500). `pnpm sprites:fetch` writes it after download; `--manifest-only` rewrites from files already present (no network). `--limit` merges those FormIds; a full fetch rewrites `forms` from a scan of `still/` and `ani/`. `--dry` writes nothing. Vite dev/build also scan the dirs so an empty committed `manifest.json` still lists GIFs you already fetched.
- Commands:
  - `pnpm sprites:fetch -- --dry` — show still + ani candidate URLs for first 10 Forms.
  - `pnpm sprites:fetch -- --manifest-only` — rebuild `manifest.json` from local files.
  - `pnpm sprites:fetch -- --limit 40` — fetch 40 for UI sanity.
  - `pnpm sprites:fetch` — all Forms.

Generated GIF/PNG blobs are git-ignored; `public/sprites/ani/.gitkeep` and `public/sprites/still/.gitkeep` keep the dirs. Commit `manifest.json` without binaries. `tools/prune-dist.mjs` never touches sprites.
