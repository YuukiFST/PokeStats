/**
 * tools/dataset/fetch.ts — network seam per ticket 09.
 * Fetches pokedex.ts, formats-data.ts from smogon/pokemon-showdown and
 * moves.js, items.js, abilities.js (compiled, plain object literals) from the
 * Showdown client CDN, plus gen9 sets from pkmn.cc,
 * plus the tiny UI sprite assets the Sets UI needs (itemicons sheet, category
 * glyphs — <100 KB, vendored into public/sprites; the 154 MB ani GIFs stay in
 * the separate opt-in sprites:fetch).
 * Writes raw fixtures to tools/dataset/fixtures (committed).
 * Required UA, timeout 15s, zero retry. Separate from build by construction.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures")
const SPRITES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/sprites")
const UA = "PokeStats/0.2.0 (+https://github.com/YuukiFST/PokeStats; dataset collector)"
const TIMEOUT_MS = 15000

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal })
    if (!res.ok) throw new Error(`fetch ${url} -> ${res.status} ${res.statusText}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal })
    if (!res.ok) throw new Error(`fetch ${url} -> ${res.status} ${res.statusText}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

async function fetchBuf(url: string): Promise<Buffer> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal })
    if (!res.ok) throw new Error(`fetch ${url} -> ${res.status} ${res.statusText}`)
    return Buffer.from(await res.arrayBuffer())
  } finally {
    clearTimeout(t)
  }
}

async function main() {
  mkdirSync(FIXTURES_DIR, { recursive: true })
  console.log(`[dataset:fetch] UA=${UA}`)
  console.log(`[dataset:fetch] fixtures -> ${FIXTURES_DIR}`)

  const pokedexUrl = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/pokedex.ts"
  const formatsUrl = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/formats-data.ts"
  const movesUrl = "https://play.pokemonshowdown.com/data/moves.js"
  const itemsUrl = "https://play.pokemonshowdown.com/data/items.js"
  const abilitiesUrl = "https://play.pokemonshowdown.com/data/abilities.js"
  const learnsetsUrl = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/learnsets.ts"

  console.log(`[dataset:fetch] fetching pokedex.ts...`)
  const pokedex = await fetchText(pokedexUrl)
  writeFileSync(resolve(FIXTURES_DIR, "pokedex.ts"), pokedex)
  console.log(`[dataset:fetch] wrote pokedex.ts ${pokedex.length} bytes`)

  console.log(`[dataset:fetch] fetching formats-data.ts...`)
  const formats = await fetchText(formatsUrl)
  writeFileSync(resolve(FIXTURES_DIR, "formats-data.ts"), formats)
  console.log(`[dataset:fetch] wrote formats-data.ts ${formats.length} bytes`)

  console.log(`[dataset:fetch] fetching learnsets.ts...`)
  const learnsets = await fetchText(learnsetsUrl)
  writeFileSync(resolve(FIXTURES_DIR, "learnsets.ts"), learnsets)
  console.log(`[dataset:fetch] wrote learnsets.ts ${learnsets.length} bytes`)

  for (const [name, url] of [["moves", movesUrl], ["items", itemsUrl], ["abilities", abilitiesUrl]] as const) {
    console.log(`[dataset:fetch] fetching ${name}.js...`)
    const text = await fetchText(url)
    writeFileSync(resolve(FIXTURES_DIR, `${name}.js`), text)
    console.log(`[dataset:fetch] wrote ${name}.js ${text.length} bytes`)
  }

  // Sets from pkmn.cc (ticket 04) — 9 files but we fetch gen9 for now and replicate note for full
  const setsUrl = "https://data.pkmn.cc/sets/gen9.json"
  console.log(`[dataset:fetch] fetching gen9 sets...`)
  const sets = await fetchJson(setsUrl)
  writeFileSync(resolve(FIXTURES_DIR, "sets-gen9.json"), JSON.stringify(sets))
  console.log(`[dataset:fetch] wrote sets-gen9.json`)

  // Tiny UI sprite assets for the Sets tooltips (item icon sheet is positioned
  // at runtime by ItemInfo.spriteNum — same scheme the Showdown client uses).
  mkdirSync(SPRITES_DIR, { recursive: true })
  const itemSheetUrl = "https://play.pokemonshowdown.com/sprites/itemicons-sheet.png"
  const itemSheet = await fetchBuf(itemSheetUrl)
  writeFileSync(resolve(SPRITES_DIR, "itemicons-sheet.png"), itemSheet)
  console.log(`[dataset:fetch] wrote itemicons-sheet.png ${itemSheet.length} bytes`)
  for (const cat of ["Physical", "Special", "Status"]) {
    const buf = await fetchBuf(`https://play.pokemonshowdown.com/sprites/categories/${cat}.png`)
    writeFileSync(resolve(SPRITES_DIR, `category-${cat.toLowerCase()}.png`), buf)
    console.log(`[dataset:fetch] wrote category-${cat.toLowerCase()}.png ${buf.length} bytes`)
  }

  const marker = {
    fetchedAt: new Date().toISOString(),
    ua: UA,
    sources: { pokedexUrl, formatsUrl, movesUrl, itemsUrl, abilitiesUrl, learnsetsUrl, setsUrl, itemSheetUrl },
    sizes: { pokedex: pokedex.length, formats: formats.length, learnsets: learnsets.length },
  }
  writeFileSync(resolve(FIXTURES_DIR, "_fetch-marker.json"), JSON.stringify(marker, null, 2))
  console.log(`[dataset:fetch] done. Next: pnpm dataset:build`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
