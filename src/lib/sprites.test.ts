import { describe, expect, it } from "vitest"
import { spriteUrls, type SpriteManifest } from "./sprites"

const empty: SpriteManifest = { version: 1, forms: {} }

const charizard = { id: "charizard", name: "Charizard", isBaseForm: true }
const megaX = { id: "charizardmegax", name: "Charizard-Mega-X", isBaseForm: false }
const base: { id: string; name: string; speciesId: number } = {
  id: "charizard",
  name: "Charizard",
  speciesId: 6,
}

describe("spriteUrls", () => {
  it("returns an empty list for a base Form when the manifest is empty", () => {
    const { list, baseFallbackUrls } = spriteUrls(charizard, "full", undefined, empty)
    expect(list).toEqual([])
    expect(baseFallbackUrls.size).toBe(0)
  })

  it("returns the local ani GIF when the Form is listed", () => {
    const manifest: SpriteManifest = { version: 1, forms: { charizard: { ani: true } } }
    const { list, baseFallbackUrls } = spriteUrls(charizard, "full", undefined, manifest)
    expect(list).toEqual(["/sprites/ani/charizard.gif"])
    expect(baseFallbackUrls.size).toBe(0)
  })

  it("falls back to the Base Form ani GIF and marks it", () => {
    const manifest: SpriteManifest = { version: 1, forms: { charizard: { ani: true } } }
    const { list, baseFallbackUrls } = spriteUrls(megaX, "full", base, manifest)
    expect(list).toEqual(["/sprites/ani/charizard.gif"])
    expect([...baseFallbackUrls]).toEqual(["/sprites/ani/charizard.gif"])
  })

  it("never emits http(s) URLs", () => {
    const manifest: SpriteManifest = {
      version: 1,
      forms: { charizard: { ani: true }, charizardmegax: { ani: true } },
    }
    for (const kind of ["thumb", "full"] as const) {
      const own = spriteUrls(charizard, kind, undefined, manifest)
      const fb = spriteUrls(megaX, kind, base, manifest)
      expect(own.list.every((u) => !u.includes("https://") && !u.includes("http:"))).toBe(true)
      expect(fb.list.every((u) => !u.includes("https://") && !u.includes("http:"))).toBe(true)
    }
  })

  it("returns an empty list for an unknown FormId", () => {
    const manifest: SpriteManifest = { version: 1, forms: { charizard: { ani: true } } }
    const { list } = spriteUrls({ id: "missingno", name: "MissingNo", isBaseForm: true }, "full", undefined, manifest)
    expect(list).toEqual([])
  })

  it("thumb with both flags uses only the still PNG", () => {
    const manifest: SpriteManifest = { version: 1, forms: { charizard: { still: true, ani: true } } }
    expect(spriteUrls(charizard, "thumb", undefined, manifest).list).toEqual(["/sprites/still/charizard.png"])
  })

  it("full with both flags uses only the ani GIF", () => {
    const manifest: SpriteManifest = { version: 1, forms: { charizard: { still: true, ani: true } } }
    expect(spriteUrls(charizard, "full", undefined, manifest).list).toEqual(["/sprites/ani/charizard.gif"])
  })

  it("thumb does not load ani GIFs when still is missing", () => {
    const manifest: SpriteManifest = { version: 1, forms: { charizard: { ani: true } } }
    expect(spriteUrls(charizard, "thumb", undefined, manifest).list).toEqual([])
  })

  it("full degrades to still when ani is missing", () => {
    const manifest: SpriteManifest = { version: 1, forms: { charizard: { still: true } } }
    expect(spriteUrls(charizard, "full", undefined, manifest).list).toEqual(["/sprites/still/charizard.png"])
  })

  it("thumb falls back to the Base Form still PNG", () => {
    const manifest: SpriteManifest = { version: 1, forms: { charizard: { still: true } } }
    const { list, baseFallbackUrls } = spriteUrls(megaX, "thumb", base, manifest)
    expect(list).toEqual(["/sprites/still/charizard.png"])
    expect([...baseFallbackUrls]).toEqual(["/sprites/still/charizard.png"])
  })
})
