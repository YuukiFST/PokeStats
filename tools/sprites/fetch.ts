/**
 * tools/sprites/fetch.ts — sprite fetcher per tickets 02 + 10.
 * Downloads Showdown ani GIFs for every Form into public/sprites/ani/<id>.gif
 * so the app can run fully offline via local path `/sprites/ani/<id>.gif`.
 *
 * - Offline after fetch; remote CDN remains fallback at runtime if local missing.
 * - Respects Smogon/Showdown — sends UA and throttles.
 * - Total: 1.686 files ~154 MB front (307 MB with shiny). This script does FRONT only.
 * - License note per 02: no source grants redistribution in a binary; user must decide to bundle
 *   or keep remote-only. Local fetch is opt-in; do not commit 154 MB to git without decision.
 *
 * Usage:
 *   pnpm sprites:fetch              # all 1.380 Forms, ~8-12 min, ~110-150 MB
 *   pnpm sprites:fetch -- --limit 40  # quick sanity (first 40)
 *   pnpm sprites:fetch -- --dry      # list candidates without downloading
 */

import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const OUT_DIR = resolve(ROOT, "public/sprites/ani")

const UA = "PokeStats/0.2.0 (+https://github.com/YuukiFST/PokeStats; sprite fetcher)"
const TIMEOUT_MS = 15000
const CONCURRENCY = 8

function toAlias(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}
function showdownAlias(name: string): string {
  let a = toAlias(name)
  a = a.replace("-mega-x", "-megax").replace("-mega-y", "-megay").replace("-mega-z", "-megaz")
  a = a.replace("-paldea-", "-paldea")
  return a
}

function candidatesFor(form: { id: string; name: string }): string[] {
  const alias = toAlias(form.name)
  const showdown = showdownAlias(form.name)
  const id = form.id
  const uniq = new Set<string>()
  const out: string[] = []
  const push = (u: string) => { if (!uniq.has(u)) { uniq.add(u); out.push(u) } }
  push(`https://play.pokemonshowdown.com/sprites/ani/${id}.gif`)
  push(`https://play.pokemonshowdown.com/sprites/ani/${showdown}.gif`)
  if (alias !== showdown) push(`https://play.pokemonshowdown.com/sprites/ani/${alias}.gif`)
  push(`https://www.smogon.com/dex/media/sprites/xy/${alias}.gif`)
  push(`https://play.pokemonshowdown.com/sprites/gen5/${showdown}.png`)
  return out
}

async function fetchBuf(url: string): Promise<Buffer | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal })
    if (!res.ok) return null
    const ct = res.headers.get("content-type") ?? ""
    // Smogon may return html on 404 even with 200? Check magic
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100) return null
    // GIF magic GIF8, PNG 89 50 4E 47
    const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46
    const isPng = buf[0] === 0x89 && buf[1] === 0x50
    if (!isGif && !isPng && !ct.includes("image")) return null
    return buf
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const limitArg = args.find((a) => a.startsWith("--limit"))
  const limit = limitArg ? parseInt(limitArg.split("=")[1] ?? args[args.indexOf(limitArg) + 1] ?? "0", 10) : 0
  const dry = args.includes("--dry")

  const corePath = resolve(ROOT, "public/dataset/core.json")
  if (!existsSync(corePath)) {
    console.error(`[sprites:fetch] missing ${corePath} — run pnpm dataset:build first`)
    process.exit(1)
  }
  const core = JSON.parse(readFileSync(corePath, "utf8")) as { forms: { id: string; name: string; speciesId: number; isBaseForm: boolean }[] }
  let forms = core.forms
  if (limit && limit > 0) forms = forms.slice(0, limit)
  console.log(`[sprites:fetch] UA=${UA}`)
  console.log(`[sprites:fetch] out -> ${OUT_DIR}`)
  console.log(`[sprites:fetch] forms ${forms.length}${limit ? ` (limit ${limit})` : ""}`)
  if (dry) {
    for (const f of forms.slice(0, 10)) console.log(f.id, candidatesFor(f))
    console.log("[sprites:fetch] dry — no downloads")
    return
  }
  mkdirSync(OUT_DIR, { recursive: true })

  let ok = 0, miss = 0, skip = 0, bytes = 0
  let idx = 0
  const queue = [...forms]

  async function worker() {
    while (queue.length) {
      const form = queue.shift()!
      const n = ++idx
      const out = resolve(OUT_DIR, `${form.id}.gif`)
      // also check .png fallback already saved? we always save as .gif even if PNG bytes
      if (existsSync(out) && existsSync(out.replace(/\.gif$/, ".png")) === false) {
        // if gif exists, skip
        const stat = (() => { try { return require("node:fs").statSync(out) } catch { return null } })()
        if (stat && stat.size > 500) { skip++; if (n % 50 === 0) console.log(`[sprites:fetch] ${n}/${forms.length} skip ${form.id}`); continue }
      }
      if (existsSync(out)) { skip++; continue }

      let buf: Buffer | null = null
      let hitUrl = ""
      for (const url of candidatesFor(form)) {
        buf = await fetchBuf(url)
        if (buf) { hitUrl = url; break }
        // polite small delay between candidates
        await new Promise((r) => setTimeout(r, 40))
      }
      if (buf) {
        // if PNG, save as .png sidecar? Keep .gif extension for local lookup to work? Save with correct ext.
        const isPng = buf[0] === 0x89
        const final = isPng ? out.replace(/\.gif$/, ".png") : out
        // also save gif path as png fallback symlink copy? For Sprite component: local checks /sprites/ani/${id}.gif first — if we saved png, that check would miss. So save both?
        // Save as .gif path even if png bytes will still render in <img> (browser sniffs). Keep simple: save to final.
        // Also copy to .gif if png so local lookup succeeds via png candidate? Our Sprite tries gif first, then png; if we only have png at .png, gif 404 still triggers remote fallback though local png exists.
        // So ensure both exist: write to final and if png, also write gif fallback as same bytes?
        // Easiest: write to out regardless.
        writeFileSync(out, buf)
        if (isPng && final !== out) writeFileSync(final, buf)
        bytes += buf.length
        ok++
        if (n % 25 === 0) console.log(`[sprites:fetch] ${n}/${forms.length} ok ${form.id} <- ${hitUrl} (${buf.length} B)`)
      } else {
        miss++
        if (n % 25 === 0) console.log(`[sprites:fetch] ${n}/${forms.length} miss ${form.id}`)
      }
      // throttle between forms
      await new Promise((r) => setTimeout(r, 80))
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker())
  await Promise.all(workers)

  console.log(`[sprites:fetch] done ok=${ok} miss=${miss} skip=${skip} bytes=${(bytes / 1024 / 1024).toFixed(2)} MB`)
  console.log(`[sprites:fetch] next: pnpm build && pnpm exec tauri build --debug  (or commit public/sprites/README.md decision re 154 MB)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
