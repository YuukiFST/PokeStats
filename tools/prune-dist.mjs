/**
 * tools/prune-dist.mjs — trims dev-only weight from dist/ before Tauri embeds it.
 * Wired via package.json "prune-dist" (tauri.conf beforeBuildCommand), so it runs
 * for every `tauri build` (debug and release) regardless of the caller's cwd.
 *
 * Sprites (public/sprites/ani) are part of the product: they stay embedded in
 * every build so the app works fully offline. Only the dataset pretty-print dump
 * (human-inspection artifact, no consumer) is stripped.
 */
import { rmSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../dist")

if (!existsSync(DIST)) {
  console.error(`[prune-dist] dist/ not found at ${DIST} - run pnpm build first`)
  process.exit(1)
}

for (const name of ["core.pretty.json", "core.json"]) {
  const p = resolve(DIST, "dataset", name)
  if (existsSync(p)) {
    rmSync(p, { force: true })
    console.log(`[prune-dist] removed dist/dataset/${name}`)
  }
}
