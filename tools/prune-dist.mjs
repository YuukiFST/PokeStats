/**
 * tools/prune-dist.mjs — trims dev-only weight from dist/ before Tauri embeds it.
 * Wired via package.json "prune-dist" (tauri.conf beforeBuildCommand), so it runs
 * for every `tauri build` (debug and release) regardless of the caller's cwd.
 *
 * Offline rule: the app works fully offline. Row/detail sprites (still/, ani/)
 * ship as bundle.resources sidecars served over the `sprite://` custom scheme
 * (see src-tauri/src/lib.rs), so they are stripped from the embedded dist to
 * keep the exe small: a cold launch maps/scans ~10MB instead of ~117MB.
 * manifest.json and the category icons stay embedded. Also stripped: the
 * dataset pretty-print dump (no consumer) and the logo source PNGs
 * (nothing references logo-source*.png; the app ships logo.webp).
 */
import { rmSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../dist")

if (!existsSync(DIST)) {
  console.error(`[prune-dist] dist/ not found at ${DIST} - run pnpm build first`)
  process.exit(1)
}

for (const rel of ["dataset/core.pretty.json", "dataset/core.json", "logo-source.png", "logo-source-clean.png"]) {
  const p = resolve(DIST, rel)
  if (existsSync(p)) {
    rmSync(p, { force: true })
    console.log(`[prune-dist] removed dist/${rel}`)
  }
}

for (const rel of ["sprites/still", "sprites/ani"]) {
  const p = resolve(DIST, rel)
  if (existsSync(p)) {
    rmSync(p, { force: true, recursive: true })
    console.log(`[prune-dist] removed dist/${rel}/ (bundle.resources sidecar)`)
  }
}
