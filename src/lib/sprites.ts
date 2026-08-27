/**
 * Sprite resolution for Forms.
 * Per .scratch issue 02: Showdown `ani/` is 1.686 GIFs 154 MB, byte-identical to Smogon `xy/` except for Legends: Z-A.
 * We try local bundled path first (`/sprites/ani/<id>.gif` — see tools/sprites/fetch.ts), then remote Showdown CDN.
 * Naming mismatch: FormId is slug without hyphens (`charizardmegax`, `greattusk`, `taurospaldeacombat`),
 * Showdown ani uses kebab with special cases (`charizard-megax`, `greattusk`, `tauros-paldeacombat`).
 * Candidate list covers both so onError can fallback.
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

/**
 * Candidates for a Form's own sprite (everything before the base-form fallback).
 */
export function getOwnSpriteCandidates(form: { id: string; name: string; speciesId?: number; isBaseForm?: boolean }): string[] {
  const alias = formToAlias(form.name)
  const showdown = showdownAliasFromName(form.name)
  const id = form.id // already slug like charizardmegax, greattusk
  const candidates: string[] = []

  // 1. Local bundled (tools/sprites/fetch.ts saves as <id>.gif regardless of remote name)
  candidates.push(`/sprites/ani/${id}.gif`)

  // 2. Remote Showdown ani — try id, showdown alias, alias (dedupe)
  const remote = new Set<string>()
  remote.add(`https://play.pokemonshowdown.com/sprites/ani/${id}.gif`)
  remote.add(`https://play.pokemonshowdown.com/sprites/ani/${showdown}.gif`)
  if (alias !== showdown) remote.add(`https://play.pokemonshowdown.com/sprites/ani/${alias}.gif`)
  // Great Tusk case: id == showdown already, but alias is great-tusk; we already have both.
  // For Mega-X, id=charizardmegax vs showdown=charizard-megax — both added.

  for (const u of remote) candidates.push(u)

  // 3. Smogon mirror (kebab with hyphens, 1-frame fallback for Iron Valiant etc.)
  candidates.push(`https://www.smogon.com/dex/media/sprites/xy/${alias}.gif`)

  // 4. Static PNG fallback (gen5 96x96) — if GIF missing
  candidates.push(`https://play.pokemonshowdown.com/sprites/gen5/${showdown}.png`)
  candidates.push(`https://play.pokemonshowdown.com/sprites/gen5/${alias}.png`)

  // 5. PokeAPI mirror by dex number for base forms only (formId == species)
  if (form.isBaseForm && typeof form.speciesId === "number") {
    candidates.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${form.speciesId}.gif`)
    candidates.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${form.speciesId}.png`)
  }

  // Dedupe preserving order
  return [...new Set(candidates)]
}

export interface SpriteCandidateList {
  list: string[]
  /** URLs that render the Base Form of the Species, not this Form itself (UI flags them). */
  baseFallbackUrls: Set<string>
}

/**
 * Own candidates first; then, for non-base Forms whose sprite no CDN has
 * (all 10 Legends: Z-A Megas — verified 404 on Showdown/Smogon/PokeAPI),
 * fall back to the Base Form of the same Species so the user sees the right
 * Pokémon instead of a placeholder. UI surfaces when the fallback is showing.
 */
export function getSpriteCandidates(
  form: { id: string; name: string; speciesId?: number; isBaseForm?: boolean },
  base?: SpriteBase,
): SpriteCandidateList {
  const own = getOwnSpriteCandidates(form)
  const baseFallbackUrls = new Set<string>()
  if (!form.isBaseForm && base && base.id !== form.id) {
    const baseShowdown = showdownAliasFromName(base.name)
    const fallbacks = [
      `/sprites/ani/${base.id}.gif`,
      `https://play.pokemonshowdown.com/sprites/ani/${base.id}.gif`,
      `https://play.pokemonshowdown.com/sprites/gen5/${baseShowdown}.png`,
      typeof base.speciesId === "number"
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${base.speciesId}.gif`
        : null,
      typeof base.speciesId === "number"
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${base.speciesId}.png`
        : null,
    ].filter((u): u is string => u !== null)
    for (const u of fallbacks) baseFallbackUrls.add(u)
  }
  return { list: [...new Set([...own, ...baseFallbackUrls])], baseFallbackUrls }
}

/** High-res artwork for lightbox — 475px official / 512px HOME / Pokemondb large.
 *  These are ~120-170 KB each vs 10-80 KB for ani GIF, but crisp at 320px.
 *  Pokemondb artwork uses kebab alias (charizard-mega-x, great-tusk) — verified 200 for those.
 *  PokeAPI official-artwork uses dex number; for alternates like 10034 (charizard-megax) we try dex number fallback if base fails.
 */
export function getHighResCandidates(
  form: { id: string; name: string; speciesId?: number; isBaseForm?: boolean },
  base?: SpriteBase,
): SpriteCandidateList {
  const alias = formToAlias(form.name) // charizard-mega-x, great-tusk, rattata-alola
  const showdown = showdownAliasFromName(form.name)
  const own: string[] = []
  // 1. PokeAPI transparent PNG — 475px official / 512px HOME (only exact base, not fallback for custom — custom would show wrong form)
  if (form.isBaseForm && typeof form.speciesId === "number") {
    own.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${form.speciesId}.png`)
    own.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${form.speciesId}.png`)
  }
  // 2. Showdown static PNG — 120px transparent, correct form alias (no white)
  own.push(`https://play.pokemonshowdown.com/sprites/gen5/${showdown}.png`)
  if (alias !== showdown) own.push(`https://play.pokemonshowdown.com/sprites/gen5/${alias}.png`)
  own.push(`https://play.pokemonshowdown.com/sprites/dex/${showdown}.png`)
  if (alias !== showdown) own.push(`https://play.pokemonshowdown.com/sprites/dex/${alias}.png`)
  // 3. Pokemondb artwork JPG — 600px but white background (opaque square), keep as last high-res fallback
  own.push(`https://img.pokemondb.net/artwork/large/${alias}.jpg`)
  own.push(`https://img.pokemondb.net/artwork/${alias}.jpg`)

  const { list, baseFallbackUrls } = getSpriteCandidates(form, base)
  return { list: [...new Set([...own, ...list])], baseFallbackUrls }
}

/** Size presets */
export const SPRITE_SIZE: Record<string, { w: number; h: number; cls: string }> = {
  sm: { w: 32, h: 32, cls: "w-8 h-8" },
  md: { w: 56, h: 56, cls: "w-14 h-14" },
  lg: { w: 96, h: 96, cls: "w-24 h-24" },
  xl: { w: 120, h: 120, cls: "w-[120px] h-[120px]" },
}
