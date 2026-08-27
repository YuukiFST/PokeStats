# Sprites

Local cache for Showdown `ani/` GIFs, embedded into every build (exe and installers) so the app works fully offline.

- Source: `https://play.pokemonshowdown.com/sprites/ani/<alias>.gif` — 1.686 files, 154.63 MB front only (per `.scratch/pokestats-v2/issues/02-fontes-sprites.md`).
- Naming: `tools/sprites/fetch.ts` resolves `Form.name` → Showdown alias (`charizard-megax`, `tauros-paldeacombat`, `greattusk`) and saves as `public/sprites/ani/<FormId>.gif` where `FormId` is the canonical slug (`charizardmegax`, `greattusk`, `taurospaldeacombat`). This decouples local path from remote naming drift (Showdown vs Smogon `xy/`).
- Offline: `src/lib/sprites.ts` tries local `/sprites/ani/<id>.gif` first, then remote CDN. After `pnpm sprites:fetch` the app is fully offline.
- Volume: `gzip -9` saves only ~2% (LZW already compressed) — size is final. Builds ship ~113 MB heavier with sprites embedded; that is intentional (product decision: art ships with the app).
- Commands:
  - `pnpm sprites:fetch -- --dry` — show candidate URLs for first 10 Forms.
  - `pnpm sprites:fetch -- --limit 40` — fetch 40 for UI sanity (~3 MB).
  - `pnpm sprites:fetch` — all 1.380 Forms.

Generated files are git-ignored (repo weight, not bundle weight); `public/sprites/ani/.gitkeep` keeps the dir. `tools/prune-dist.mjs` never touches sprites — only the dataset pretty-print dump.
