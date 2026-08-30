/**
 * Sprite resolution for Forms.
 * Runtime URLs come only from the local manifest (`public/sprites/manifest.json`).
 * Missing FormIds render the existing placeholder — the app never requests CDNs.
 * Naming mismatch (FormId slug vs Showdown kebab) is handled at fetch time via aliases.
 */

export function formToAlias(name: string): string {
  // "Great Tusk" -> "great-tusk", "Charizard-Mega-X" -> "charizard-mega-x", "Tauros-Paldea-Combat" -> "tauros-paldea-combat"
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function showdownAliasFromName(name: string): string {
  let a = formToAlias(name)
  // Showdown strips hyphen between mega and x/y/z (smogon keeps it)
  a = a.replace("-mega-x", "-megax").replace("-mega-y", "-megay").replace("-mega-z", "-megaz")
  // Paldea Tauros variants: showdown uses "paldeacombat" not "paldea-combat"
  a = a.replace("-paldea-", "-paldea")
  // Hisui/Alola/Galar generally keep hyphen, no fix needed
  return a
}

export type SpriteBase = { id: string; name: string; speciesId: number }

export type SpriteKind = "thumb" | "full"

export interface SpriteManifest {
  version: number
  forms: Record<string, { still?: boolean; ani?: boolean }>
}

const EMPTY_MANIFEST: SpriteManifest = { version: 1, forms: {} }

let manifestCache: SpriteManifest | null = null
let manifestInflight: Promise<SpriteManifest> | null = null

export function setSpriteManifestForTests(m: SpriteManifest | null): void {
  manifestCache = m
  manifestInflight = null
}

export function getSpriteManifestSync(): SpriteManifest | null {
  return manifestCache
}

export async function loadSpriteManifest(): Promise<SpriteManifest> {
  if (manifestCache) return manifestCache
  if (manifestInflight) return manifestInflight

  manifestInflight = (async () => {
    try {
      const res = await fetch("/sprites/manifest.json")
      if (!res.ok) {
        manifestCache = EMPTY_MANIFEST
        return manifestCache
      }
      const json = (await res.json()) as SpriteManifest
      if (!json || typeof json !== "object" || typeof json.forms !== "object" || json.forms === null) {
        manifestCache = EMPTY_MANIFEST
        return manifestCache
      }
      manifestCache = { version: json.version ?? 1, forms: json.forms }
      return manifestCache
    } catch {
      manifestCache = EMPTY_MANIFEST
      return manifestCache
    }
  })()

  try {
    return await manifestInflight
  } finally {
    manifestInflight = null
  }
}

export function spriteUrls(
  form: { id: string; name: string; isBaseForm?: boolean },
  kind: SpriteKind,
  base: SpriteBase | undefined,
  manifest: SpriteManifest,
): { list: string[]; baseFallbackUrls: Set<string> } {
  const list: string[] = []
  const baseFallbackUrls = new Set<string>()
  const own = manifest.forms[form.id]
  const baseEntry = base ? manifest.forms[base.id] : undefined

  const take = (url: string, fromBase: boolean) => {
    list.push(url)
    if (fromBase) baseFallbackUrls.add(url)
  }

  if (kind === "thumb") {
    if (own?.still) take(`/sprites/still/${form.id}.png`, false)
    else if (base && baseEntry?.still) take(`/sprites/still/${base.id}.png`, true)
  } else {
    if (own?.ani) take(`/sprites/ani/${form.id}.gif`, false)
    else if (own?.still) take(`/sprites/still/${form.id}.png`, false)
    else if (base && baseEntry?.ani) take(`/sprites/ani/${base.id}.gif`, true)
    else if (base && baseEntry?.still) take(`/sprites/still/${base.id}.png`, true)
  }
  return { list, baseFallbackUrls }
}

/** Size presets */
export const SPRITE_SIZE: Record<string, { w: number; h: number; cls: string }> = {
  sm: { w: 32, h: 32, cls: "w-8 h-8" },
  md: { w: 56, h: 56, cls: "w-14 h-14" },
  lg: { w: 96, h: 96, cls: "w-24 h-24" },
  xl: { w: 120, h: 120, cls: "w-[120px] h-[120px]" },
}

if (typeof window !== "undefined") {
  void loadSpriteManifest().catch(() => {})
}
