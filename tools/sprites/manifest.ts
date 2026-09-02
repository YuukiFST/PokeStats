/**
 * Disk scan for public/sprites/manifest.json.
 * Runtime never lists the filesystem — Vite/dev and sprites:fetch write this file.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

export const SPRITE_ANI_DIR = resolve(ROOT, "public/sprites/ani")
export const SPRITE_STILL_DIR = resolve(ROOT, "public/sprites/still")
export const SPRITE_MANIFEST_PATH = resolve(ROOT, "public/sprites/manifest.json")

export type SpriteManifestForms = Record<string, { still?: boolean; ani?: boolean }>

export interface SpriteManifestFile {
  version: number
  forms: SpriteManifestForms
}

function fileOk(p: string): boolean {
  if (!existsSync(p)) return false
  try {
    return statSync(p).size > 500
  } catch {
    return false
  }
}

export function flagsFromDisk(id: string): { still?: boolean; ani?: boolean } {
  const entry: { still?: boolean; ani?: boolean } = {}
  if (fileOk(resolve(SPRITE_STILL_DIR, `${id}.png`))) entry.still = true
  if (fileOk(resolve(SPRITE_ANI_DIR, `${id}.gif`))) entry.ani = true
  return entry
}

/** Full rewrite from files on disk (stale FormIds disappear). */
export function scanSpriteManifest(): SpriteManifestFile {
  const forms: SpriteManifestForms = {}
  const ids = new Set<string>()
  if (existsSync(SPRITE_STILL_DIR)) {
    for (const name of readdirSync(SPRITE_STILL_DIR)) {
      if (name.endsWith(".png")) ids.add(name.slice(0, -4))
    }
  }
  if (existsSync(SPRITE_ANI_DIR)) {
    for (const name of readdirSync(SPRITE_ANI_DIR)) {
      if (name.endsWith(".gif")) ids.add(name.slice(0, -4))
    }
  }
  for (const id of ids) {
    const flags = flagsFromDisk(id)
    if (flags.still || flags.ani) forms[id] = flags
  }
  return { version: 1, forms }
}

/** `limited` merges those FormIds only; null = full disk scan. */
export function writeSpriteManifest(limited: { id: string }[] | null): SpriteManifestFile {
  let forms: SpriteManifestForms = {}
  if (limited) {
    if (existsSync(SPRITE_MANIFEST_PATH)) {
      try {
        const prev = JSON.parse(readFileSync(SPRITE_MANIFEST_PATH, "utf8")) as { forms?: SpriteManifestForms }
        if (prev.forms && typeof prev.forms === "object") forms = { ...prev.forms }
      } catch {
        forms = {}
      }
    }
    for (const f of limited) {
      const flags = flagsFromDisk(f.id)
      if (flags.still || flags.ani) forms[f.id] = flags
      else delete forms[f.id]
    }
  } else {
    forms = scanSpriteManifest().forms
  }
  const out: SpriteManifestFile = { version: 1, forms }
  mkdirSync(dirname(SPRITE_MANIFEST_PATH), { recursive: true })
  writeFileSync(SPRITE_MANIFEST_PATH, `${JSON.stringify(out)}\n`)
  return out
}
